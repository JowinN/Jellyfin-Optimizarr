import os
import signal
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List
import psutil
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from app.database import AsyncSessionLocal
from app.models.job import EncodingJob, JobLog
from app.models.media import MediaItem
from app.models.profile import EncodingProfile
from app.config import settings
from app.services.ffmpeg_builder import ffmpeg_command_builder
from app.services.validator import output_validator
from app.services.replacement_manager import replacement_manager
from app.services.notification_service import notification_service
from app.core.logging import logger
from app.core.events import event_broadcaster

class QueueWorker:
    """Persistent database-backed background worker executing media optimization jobs."""

    def __init__(self):
        self._is_running = False
        self._is_paused = False
        self._current_process: Optional[asyncio.subprocess.Process] = None
        self._current_job_id: Optional[int] = None
        self._cancelled_job_id: Optional[int] = None
        self._worker_task: Optional[asyncio.Task] = None

    def start(self):
        if not self._is_running:
            self._is_running = True
            self._worker_task = asyncio.create_task(self._run_loop())
            logger.info("Queue Worker started.")

    def stop(self):
        self._is_running = False
        if self._worker_task:
            self._worker_task.cancel()
        logger.info("Queue Worker stopped.")

    def pause(self):
        self._is_paused = True
        logger.info("Queue Worker paused.")

    def resume(self):
        self._is_paused = False
        logger.info("Queue Worker resumed.")

    async def cancel_current_job(self) -> bool:
        """Cleanly terminates the currently active FFmpeg process and its process group."""
        self._cancelled_job_id = self._current_job_id
        if self._current_process and self._current_process.returncode is None:
            try:
                pid = self._current_process.pid
                logger.info(f"Terminating active FFmpeg process PID: {pid}")
                # Send SIGTERM to process group if supported
                try:
                    os.killpg(os.getpgid(pid), signal.SIGTERM)
                except (AttributeError, ProcessLookupError, PermissionError):
                    self._current_process.terminate()

                await asyncio.sleep(1.0)
                if self._current_process.returncode is None:
                    try:
                        os.killpg(os.getpgid(pid), signal.SIGKILL)
                    except (AttributeError, ProcessLookupError, PermissionError):
                        self._current_process.kill()

                return True
            except Exception as e:
                logger.error(f"Error terminating process: {e}")
                return False
        return False

    async def recover_interrupted_jobs(self):
        """Scans for local jobs left in 'running', 'probing', or 'validating' on startup and safely resets them."""
        async with AsyncSessionLocal() as session:
            stmt = select(EncodingJob).where(
                and_(
                    EncodingJob.status.in_(["running", "probing", "validating", "replacing"]),
                    EncodingJob.assigned_node_id.in_([None, "local", "any", ""]),
                )
            )
            res = await session.execute(stmt)
            jobs = res.scalars().all()
            for job in jobs:
                job.status = "pending"
                job.stage = "queued"
                job.progress_percent = 0.0
                job.current_fps = 0.0
                job.current_speed = 0.0
                job.eta_seconds = 0
                job.out_time_seconds = 0.0
                job.error_message = None
                logger.warning(f"Recovered interrupted local job {job.id}. Reset status to pending for clean retry.")

                # Clean up any leftover temporary file in /work
                if job.temp_output_path and os.path.exists(job.temp_output_path):
                    try:
                        os.remove(job.temp_output_path)
                        logger.info(f"Cleaned up stale temp file: {job.temp_output_path}")
                    except OSError:
                        pass
            await session.commit()

    async def _run_loop(self):
        await self.recover_interrupted_jobs()

        while self._is_running:
            if self._is_paused:
                await asyncio.sleep(2.0)
                continue

            try:
                job_to_process = await self._fetch_next_job()
                if job_to_process:
                    await self._process_job(job_to_process["id"])
                else:
                    await asyncio.sleep(3.0)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unhandled exception in queue loop: {e}", exc_info=True)
                await asyncio.sleep(5.0)

    async def _fetch_next_job(self) -> Optional[Dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            while True:
                stmt = (
                    select(EncodingJob)
                    .where(
                        and_(
                            EncodingJob.status == "pending",
                            EncodingJob.assigned_node_id.in_([None, "local", "any", ""]),
                        )
                    )
                    .order_by(EncodingJob.priority.desc(), EncodingJob.created_at.asc())
                    .limit(1)
                )
                res = await session.execute(stmt)
                job = res.scalar_one_or_none()
                if not job:
                    return None

                stmt_media = select(MediaItem).where(MediaItem.id == job.media_item_id)
                media_item = (await session.execute(stmt_media)).scalar_one_or_none()
                if not media_item:
                    job.status = "cancelled"
                    job.stage = "cancelled"
                    job.error_message = "Stale job: media item not found"
                    await session.commit()
                    continue

                stmt_completed = select(EncodingJob.id).where(
                    and_(
                        EncodingJob.media_item_id == media_item.id,
                        EncodingJob.id != job.id,
                        EncodingJob.status == "completed",
                    )
                ).limit(1)
                completed_job_id = (await session.execute(stmt_completed)).scalar_one_or_none()

                if completed_job_id or media_item.optimization_status == "optimized":
                    logger.info(
                        f"Skipping redundant pending local Job #{job.id} for '{media_item.filename}'. "
                        f"Item was already completed by Job #{completed_job_id or 'earlier'}."
                    )
                    job.status = "cancelled"
                    job.stage = "cancelled"
                    job.error_message = f"Cancelled: Media item was already successfully optimized by earlier completed job #{completed_job_id or 'prior'}"
                    media_item.optimization_status = "optimized"
                    await session.commit()
                    continue

                return {"id": job.id}

    async def _process_job(self, job_id: int):
        self._current_job_id = job_id
        async with AsyncSessionLocal() as session:
            stmt = select(EncodingJob).where(EncodingJob.id == job_id)
            res = await session.execute(stmt)
            job = res.scalar_one_or_none()
            if not job:
                return

            # Fetch MediaItem and Profile
            stmt_media = select(MediaItem).where(MediaItem.id == job.media_item_id)
            media_item = (await session.execute(stmt_media)).scalar_one_or_none()

            stmt_prof = select(EncodingProfile).where(EncodingProfile.id == job.profile_id)
            profile = (await session.execute(stmt_prof)).scalar_one_or_none()

            if not media_item or not profile:
                job.status = "failed"
                job.error_message = "Referenced media item or profile no longer exists."
                await session.commit()
                return

            source_path = media_item.path

            # Acquire file lock
            locked = await replacement_manager.acquire_file_lock(source_path)
            if not locked:
                job.error_message = "File is locked by another operation. Will retry."
                job.status = "pending"
                await session.commit()
                return

            temp_output = os.path.join(settings.WORK_DIR, f"encode_{job.id}_{os.path.basename(source_path)}")
            job.temp_output_path = temp_output
            job.status = "running"
            job.stage = "encoding"
            job.started_at = datetime.utcnow()
            job.assigned_node_id = "local"
            job.assigned_node_name = "Ubuntu Server (Local)"
            media_item.optimization_status = "processing"
            await session.commit()

            try:
                # Pre-flight: Check free disk space in /work
                space_ok, free_gb = replacement_manager.check_disk_space(settings.WORK_DIR, settings.MIN_FREE_SPACE_GB)
                if not space_ok:
                    raise RuntimeError(f"Pre-flight failed: Insufficient space in /work ({free_gb} GB free, minimum is {settings.MIN_FREE_SPACE_GB} GB).")

                # Record pre-encode source attributes
                stat = os.stat(source_path)
                pre_mtime = stat.st_mtime
                pre_size = stat.st_size

                # Build FFmpeg command
                cmd = ffmpeg_command_builder.build_command(
                    input_path=source_path,
                    output_path=temp_output,
                    profile=profile,
                    media_info={
                        "width": media_item.width,
                        "height": media_item.height,
                        "is_hdr": media_item.is_hdr,
                        "bit_depth": media_item.bit_depth,
                        "streams_detail": media_item.streams_detail or {},
                        "size_bytes": media_item.size_bytes or pre_size,
                        "duration_seconds": media_item.duration_seconds,
                    },
                )
                job.ffmpeg_command_args = cmd
                await session.commit()

                # Start FFmpeg process
                logger.info(f"Launching FFmpeg for Job {job.id}: {source_path} -> {temp_output}")

                # Use process groups on POSIX for clean tree termination
                kwargs = {}
                if hasattr(os, "setsid"):
                    kwargs["preexec_fn"] = os.setsid

                self._current_process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    **kwargs
                )
                job.process_pid = self._current_process.pid
                await session.commit()

                # Read progress stream
                await self._monitor_ffmpeg_progress(session, job, media_item.duration_seconds)

                returncode = await self._current_process.wait()
                if returncode != 0:
                    err_msg = ""
                    if self._current_process.stderr:
                        try:
                            raw_err = await self._current_process.stderr.read()
                            lines = [l.strip() for l in raw_err.decode(errors="replace").splitlines() if l.strip()]
                            err_msg = " | ".join(lines[-3:])
                        except Exception:
                            pass
                    self._current_process = None
                    raise RuntimeError(f"FFmpeg failed with exit code {returncode}: {err_msg[:300]}")
                self._current_process = None

                # Stage: VALIDATION
                job.stage = "validating"
                job.progress_percent = 100.0
                await session.commit()
                await event_broadcaster.broadcast("job_status", {"id": job.id, "stage": "validating"})

                is_valid, validation_errors = await output_validator.validate(
                    output_path=temp_output,
                    source_info={
                        "duration_seconds": media_item.duration_seconds,
                        "audio_tracks_count": media_item.audio_tracks_count,
                        "subtitle_tracks_count": media_item.subtitle_tracks_count,
                        "size_bytes": pre_size,
                    },
                    profile=profile,
                )

                if not is_valid:
                    error_detail = "; ".join(validation_errors)
                    raise RuntimeError(f"Output validation failed: {error_detail}")

                # Stage: REPLACEMENT
                job.stage = "replacing"
                await session.commit()
                await event_broadcaster.broadcast("job_status", {"id": job.id, "stage": "replacing"})

                replace_ok, replace_msg, backup_path = await replacement_manager.execute_replacement(
                    session=session,
                    media_item=media_item,
                    temp_encoded_path=temp_output,
                    replacement_mode=job.replacement_mode,
                    pre_encode_mtime=pre_mtime,
                    pre_encode_size=pre_size,
                    job_id=job.id,
                )

                if not replace_ok:
                    raise RuntimeError(f"Replacement failed: {replace_msg}")

                # Success handling
                job.backup_path = backup_path
                job.status = "completed"
                job.stage = "completed"
                job.completed_at = datetime.utcnow()
                job.output_size_bytes = os.path.getsize(source_path)
                job.savings_bytes = pre_size - job.output_size_bytes
                job.savings_percent = round((job.savings_bytes / pre_size) * 100, 1) if pre_size > 0 else 0.0

                media_item.size_bytes = job.output_size_bytes
                media_item.optimization_status = "optimized"
                media_item.last_optimized_at = datetime.utcnow()
                media_item.applied_profile_id = profile.id
                media_item.applied_profile_name = profile.name
                media_item.mb_per_minute = round((job.output_size_bytes / (1024 * 1024)) / (media_item.duration_seconds / 60.0), 2) if media_item.duration_seconds > 0 else 0.0

                await session.commit()

                # Dispatch Success Alert
                saved_mb = round(job.savings_bytes / (1024 * 1024), 1)
                await notification_service.send_alert(
                    title="Optimization Complete",
                    message=f"Successfully optimized '{media_item.filename}'. Saved {saved_mb} MB ({job.savings_percent}%).",
                    event_type="job_completed",
                )

                logger.info(f"Job {job.id} completed successfully. Saved {saved_mb} MB.")

            except Exception as e:
                is_cancelled = (self._cancelled_job_id == job.id) or (job.status == "cancelled")
                if is_cancelled:
                    logger.info(f"Job {job.id} was cancelled by user. Cleaning up.")
                    job.status = "cancelled"
                    job.stage = "cancelled"
                    job.error_message = "Cancelled by user"
                    media_item.optimization_status = "optimized" if media_item.last_optimized_at else "unoptimized"
                    await session.commit()
                else:
                    logger.error(f"Job {job.id} failed: {e}")
                    job.status = "failed"
                    job.stage = "failed"
                    job.error_message = str(e)

                    stmt_completed = select(EncodingJob.id).where(
                        and_(
                            EncodingJob.media_item_id == media_item.id,
                            EncodingJob.id != job.id,
                            EncodingJob.status == "completed",
                        )
                    ).limit(1)
                    has_completed = (await session.execute(stmt_completed)).scalar_one_or_none()
                    if has_completed:
                        media_item.optimization_status = "optimized"
                        job.error_message = f"Superseded: Item was already optimized by Job #{has_completed}. {str(e)}"
                    else:
                        media_item.optimization_status = "failed"

                    await session.commit()

                    # Dispatch Failure Alert only on real failure
                    if not has_completed:
                        await notification_service.send_alert(
                            title="Encoding Job Failed",
                            message=f"Failed to optimize '{media_item.filename}': {str(e)[:200]}",
                            event_type="job_failed",
                            priority="high",
                        )

                # Cleanup partial temporary file
                if os.path.exists(temp_output):
                    try:
                        os.remove(temp_output)
                    except OSError:
                        pass

            finally:
                # Ensure active process is cleanly terminated if job errored or crashed
                if self._current_process and self._current_process.returncode is None:
                    try:
                        logger.warning(f"Terminating active process for Job {job_id} on worker cleanup.")
                        self._current_process.terminate()
                    except Exception:
                        pass
                self._current_job_id = None
                self._cancelled_job_id = None
                self._current_process = None
                await replacement_manager.release_file_lock(source_path)
                await event_broadcaster.broadcast("job_status", {"id": job.id, "status": job.status})

    async def _monitor_ffmpeg_progress(self, session: AsyncSession, job: EncodingJob, total_duration_seconds: float):
        if not self._current_process or not self._current_process.stdout:
            return

        out_time_s = 0.0
        fps_val = 0.0
        speed_val = 1.0
        last_commit_time = 0.0

        # Background task to continuously drain stderr so OS pipe buffer never deadlocks FFmpeg
        async def _drain_stderr():
            if self._current_process and self._current_process.stderr:
                try:
                    while self._current_process and self._current_process.returncode is None:
                        line = await self._current_process.stderr.readline()
                        if not line:
                            break
                except Exception:
                    pass

        stderr_task = asyncio.create_task(_drain_stderr())

        try:
            while self._current_process and self._current_process.returncode is None:
                line = await self._current_process.stdout.readline()
                if not line:
                    break

                decoded = line.decode("utf-8", errors="ignore").strip()
                if "=" in decoded:
                    key, val = decoded.split("=", 1)
                    key = key.strip()
                    val = val.strip()

                    if key == "out_time_ms":
                        try:
                            out_time_s = float(val) / 1000000.0
                        except ValueError:
                            pass
                    elif key == "fps":
                        try:
                            fps_val = float(val)
                        except ValueError:
                            pass
                    elif key == "speed":
                        val_str = val.replace("x", "").strip()
                        try:
                            speed_val = float(val_str)
                        except ValueError:
                            pass
                    elif key == "progress" and val in ("continue", "end"):
                        now = asyncio.get_event_loop().time()
                        # Throttle DB commits to every 3.0s or on finish to avoid SQLite lock contention
                        if (now - last_commit_time >= 3.0) or val == "end":
                            last_commit_time = now
                            if total_duration_seconds > 0:
                                pct = min(99.0, (out_time_s / total_duration_seconds) * 100.0)
                                remaining_s = max(0, total_duration_seconds - out_time_s)
                                eta_s = int(remaining_s / speed_val) if speed_val > 0 else 0
                            else:
                                pct = 0.0
                                eta_s = 0

                            job.progress_percent = round(pct, 1)
                            job.current_fps = fps_val
                            job.current_speed = speed_val
                            job.eta_seconds = eta_s
                            job.out_time_seconds = round(out_time_s, 1)

                            try:
                                await session.commit()
                                await event_broadcaster.broadcast("job_progress", {
                                    "id": job.id,
                                    "progress": job.progress_percent,
                                    "fps": job.current_fps,
                                    "speed": job.current_speed,
                                    "eta_seconds": job.eta_seconds,
                                })
                            except Exception as commit_err:
                                logger.warning(f"Non-fatal progress commit error for Job #{job.id}: {commit_err}. Rolling back session.")
                                try:
                                    await session.rollback()
                                except Exception:
                                    pass
        finally:
            stderr_task.cancel()

queue_worker = QueueWorker()
