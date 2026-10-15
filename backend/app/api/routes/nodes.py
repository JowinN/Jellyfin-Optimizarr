import os
import shutil
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.database import get_db, AsyncSessionLocal
from app.models.job import EncodingJob
from app.models.media import MediaItem
from app.models.profile import EncodingProfile
from app.config import settings
from app.core.logging import logger
from app.core.events import event_broadcaster
from app.services.validator import output_validator
from app.services.replacement_manager import replacement_manager
from app.services.notification_service import notification_service

router = APIRouter(prefix="/nodes", tags=["Distributed Worker Nodes"])

class NodeRegisterRequest(BaseModel):
    node_id: str
    name: str
    os_info: str = "Windows"
    cpu_model: str = "Unknown CPU"
    cpu_cores: int = 4
    gpu_model: Optional[str] = None
    supported_encoders: List[str] = []

class NodeHeartbeatRequest(BaseModel):
    node_id: str
    current_job_id: Optional[int] = None
    cpu_percent: Optional[float] = None
    ram_percent: Optional[float] = None

class ProgressReportRequest(BaseModel):
    progress_percent: float
    current_fps: float = 0.0
    current_speed: float = 0.0
    eta_seconds: int = 0
    out_time_seconds: float = 0.0

# In-memory registry of worker nodes
_registered_nodes: Dict[str, Dict[str, Any]] = {}

@router.get("")
async def list_worker_nodes():
    """Lists all cluster nodes including local server and remote workers."""
    now = datetime.utcnow()
    nodes = []

    # Local Server Node
    nodes.append({
        "node_id": "local",
        "name": "Ubuntu Home Server (Host)",
        "os_info": "Ubuntu Linux",
        "cpu_model": "Intel Core i5-6300U",
        "cpu_cores": 2,
        "gpu_model": "Intel HD Graphics 520 (VAAPI)",
        "status": "online",
        "is_primary": True,
        "last_seen": now.isoformat(),
        "supported_encoders": ["h264_vaapi", "libx264", "libx265"],
    })

    # Remote Nodes
    for nid, data in _registered_nodes.items():
        last_hb = data.get("last_heartbeat")
        is_online = False
        if last_hb and (now - last_hb).total_seconds() < 45:
            is_online = True

        nodes.append({
            "node_id": nid,
            "name": data.get("name", nid),
            "os_info": data.get("os_info", "Windows"),
            "cpu_model": data.get("cpu_model", "Desktop CPU"),
            "cpu_cores": data.get("cpu_cores", 4),
            "gpu_model": data.get("gpu_model", "NVIDIA GPU"),
            "status": "online" if is_online else "offline",
            "is_primary": False,
            "last_seen": last_hb.isoformat() if last_hb else None,
            "supported_encoders": data.get("supported_encoders", []),
            "current_job_id": data.get("current_job_id"),
        })

    return nodes

@router.post("/register")
async def register_node(req: NodeRegisterRequest):
    """Registers a remote encoding worker node."""
    _registered_nodes[req.node_id] = {
        "node_id": req.node_id,
        "name": req.name,
        "os_info": req.os_info,
        "cpu_model": req.cpu_model,
        "cpu_cores": req.cpu_cores,
        "gpu_model": req.gpu_model,
        "supported_encoders": req.supported_encoders,
        "last_heartbeat": datetime.utcnow(),
        "current_job_id": None,
    }
    logger.info(f"Registered remote worker node: {req.name} ({req.node_id})")
    await event_broadcaster.broadcast("nodes_updated", {"node_id": req.node_id, "status": "online"})
    return {"message": f"Node '{req.name}' successfully registered.", "node_id": req.node_id}

@router.post("/heartbeat")
async def heartbeat_node(
    req: NodeHeartbeatRequest,
    session: AsyncSession = Depends(get_db),
):
    """Updates heartbeat for a registered node and checks if assigned job is still active."""
    cancel_job_id = None
    if req.current_job_id:
        stmt = select(EncodingJob.status).where(EncodingJob.id == req.current_job_id)
        job_status = (await session.execute(stmt)).scalar_one_or_none()
        if not job_status or job_status in ("cancelled", "failed"):
            cancel_job_id = req.current_job_id

    if req.node_id in _registered_nodes:
        _registered_nodes[req.node_id]["last_heartbeat"] = datetime.utcnow()
        _registered_nodes[req.node_id]["current_job_id"] = req.current_job_id
    else:
        _registered_nodes[req.node_id] = {
            "node_id": req.node_id,
            "name": req.node_id,
            "last_heartbeat": datetime.utcnow(),
            "current_job_id": req.current_job_id,
        }
    return {"status": "ok", "cancel_job_id": cancel_job_id}

@router.get("/jobs/{job_id}/status")
async def get_job_node_status(
    job_id: int,
    session: AsyncSession = Depends(get_db),
):
    """Allows worker node to quickly check if a job is still active or was cancelled."""
    stmt = select(EncodingJob.status).where(EncodingJob.id == job_id)
    status_val = (await session.execute(stmt)).scalar_one_or_none()
    if not status_val or status_val in ("cancelled", "failed"):
        return {"status": status_val or "not_found", "should_cancel": True}
    return {"status": status_val, "should_cancel": False}

@router.get("/poll")
async def poll_job_for_node(
    node_id: str = Query(..., description="Worker node ID"),
    node_name: str = Query("Remote Worker", description="Worker display name"),
    session: AsyncSession = Depends(get_db),
):
    """Allows a remote worker node to lease the next pending job."""
    stmt = (
        select(EncodingJob)
        .where(
            and_(
                EncodingJob.status == "pending",
                or_(
                    EncodingJob.assigned_node_id.is_(None),
                    EncodingJob.assigned_node_id.in_(["any", "", node_id]),
                ),
            )
        )
        .order_by(EncodingJob.priority.desc(), EncodingJob.created_at.asc())
        .limit(1)
    )
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job:
        return {"has_job": False, "job": None}

    # Fetch related media item and profile
    stmt_media = select(MediaItem).where(MediaItem.id == job.media_item_id)
    media_item = (await session.execute(stmt_media)).scalar_one_or_none()

    stmt_profile = select(EncodingProfile).where(EncodingProfile.id == job.profile_id)
    profile = (await session.execute(stmt_profile)).scalar_one_or_none()

    if not media_item or not profile:
        return {"has_job": False, "job": None}

    # Transition job to running on remote node
    job.status = "running"
    job.stage = "encoding_remote"
    job.started_at = datetime.utcnow()
    job.assigned_node_id = node_id
    job.assigned_node_name = node_name
    media_item.optimization_status = "processing"

    await session.commit()
    await session.refresh(job)

    await event_broadcaster.broadcast("job_status", {
        "id": job.id,
        "status": "running",
        "stage": "encoding_remote",
        "assigned_node_name": node_name,
    })

    logger.info(f"Leased Job #{job.id} ('{media_item.filename}') to remote node '{node_name}'")

    return {
        "has_job": True,
        "job": {
            "id": job.id,
            "filename": os.path.basename(job.source_path),
            "source_size_bytes": job.source_size_bytes,
            "replacement_mode": job.replacement_mode,
            "download_url": f"/api/nodes/jobs/{job.id}/source",
            "media": {
                "duration_seconds": media_item.duration_seconds,
                "width": media_item.width,
                "height": media_item.height,
                "video_codec": media_item.video_codec,
                "bit_depth": media_item.bit_depth,
                "is_hdr": media_item.is_hdr,
                "audio_tracks_count": media_item.audio_tracks_count,
                "subtitle_tracks_count": media_item.subtitle_tracks_count,
                "streams_detail": media_item.streams_detail,
            },
            "profile": {
                "name": profile.name,
                "video_codec": profile.video_codec,
                "scale_down_percent": getattr(profile, "scale_down_percent", 0) or 0,
                "target_mb_per_minute": getattr(profile, "target_mb_per_minute", 0.0) or 0.0,
                "min_storage_saving_percent": getattr(profile, "min_storage_saving_percent", 0.0) or 0.0,
                "target_bitrate_kbps": profile.target_bitrate_kbps,
                "crf": profile.crf,
                "encoder_preset": profile.encoder_preset,
                "pixel_format": profile.pixel_format,
                "audio_policy": profile.audio_policy,
                "preferred_audio_codec": profile.preferred_audio_codec,
                "audio_bitrate_kbps": profile.audio_bitrate_kbps,
                "subtitle_policy": profile.subtitle_policy,
                "resolution_mode": profile.resolution_mode,
                "max_height": profile.max_height,
                "hwaccel_type": profile.hwaccel_type,
            },
        },
    }

@router.get("/jobs/{job_id}/source")
async def stream_job_source_file(
    job_id: int,
    session: AsyncSession = Depends(get_db),
):
    """Streams the source media file to the remote worker node."""
    stmt = select(EncodingJob).where(EncodingJob.id == job_id)
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job or not os.path.exists(job.source_path):
        raise HTTPException(status_code=404, detail="Source file not found")

    return FileResponse(
        path=job.source_path,
        filename=os.path.basename(job.source_path),
        media_type="application/octet-stream",
    )

@router.post("/jobs/{job_id}/progress")
async def report_job_progress(
    job_id: int,
    req: ProgressReportRequest,
    session: AsyncSession = Depends(get_db),
):
    """Receives real-time encoding telemetry from a remote worker node."""
    stmt = select(EncodingJob).where(EncodingJob.id == job_id)
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job or job.status in ("cancelled", "failed"):
        return {"status": "cancelled", "should_cancel": True}

    job.progress_percent = min(100.0, max(0.0, req.progress_percent))
    job.current_fps = req.current_fps
    job.current_speed = req.current_speed
    job.eta_seconds = req.eta_seconds
    job.out_time_seconds = req.out_time_seconds
    await session.commit()

    # Broadcast live SSE update to web dashboard
    await event_broadcaster.broadcast("job_progress", {
        "id": job.id,
        "progress": job.progress_percent,
        "speed": job.current_speed,
        "fps": job.current_fps,
        "eta": job.eta_seconds,
    })

    return {"status": "ok", "should_cancel": False}

@router.post("/jobs/{job_id}/upload")
async def upload_job_output(
    job_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
):
    """Receives completed encoded file from remote node, validates, and performs replacement."""
    stmt = select(EncodingJob).where(EncodingJob.id == job_id)
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job or job.status in ("cancelled", "failed"):
        raise HTTPException(status_code=409, detail="Job was cancelled by user; upload aborted.")

    stmt_media = select(MediaItem).where(MediaItem.id == job.media_item_id)
    media_item = (await session.execute(stmt_media)).scalar_one_or_none()
    stmt_profile = select(EncodingProfile).where(EncodingProfile.id == job.profile_id)
    profile = (await session.execute(stmt_profile)).scalar_one_or_none()

    if not media_item or not profile:
        raise HTTPException(status_code=404, detail="Associated media item or profile not found")

    # Save uploaded file to /work directory
    target_work_file = os.path.join(settings.WORK_DIR, f"remote_encode_{job.id}_{media_item.filename}")
    job.temp_output_path = target_work_file
    job.stage = "validating"
    job.progress_percent = 100.0
    await session.commit()
    await event_broadcaster.broadcast("job_status", {"id": job.id, "stage": "validating"})

    try:
        with open(target_work_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Run 6-point output validator
        pre_size = media_item.size_bytes
        pre_mtime = media_item.mtime

        is_valid, validation_errors = await output_validator.validate(
            output_path=target_work_file,
            source_info={
                "duration_seconds": media_item.duration_seconds,
                "audio_tracks_count": media_item.audio_tracks_count,
                "subtitle_tracks_count": media_item.subtitle_tracks_count,
                "size_bytes": pre_size,
            },
            profile=profile,
        )

        if not is_valid:
            error_msg = "; ".join(validation_errors)
            if os.path.exists(target_work_file):
                try:
                    os.remove(target_work_file)
                except OSError:
                    pass
            raise RuntimeError(f"Output validation failed: {error_msg}")

        # Execute safe atomic replacement
        job.stage = "replacing"
        await session.commit()
        await event_broadcaster.broadcast("job_status", {"id": job.id, "stage": "replacing"})

        replace_ok, replace_msg, backup_path = await replacement_manager.execute_replacement(
            session=session,
            media_item=media_item,
            temp_encoded_path=target_work_file,
            replacement_mode=job.replacement_mode,
            pre_encode_mtime=pre_mtime,
            pre_encode_size=pre_size,
            job_id=job.id,
        )

        if not replace_ok:
            if os.path.exists(target_work_file):
                try:
                    os.remove(target_work_file)
                except OSError:
                    pass
            raise RuntimeError(f"Replacement failed: {replace_msg}")

        # Finalize job completion
        job.backup_path = backup_path
        job.status = "completed"
        job.stage = "completed"
        job.completed_at = datetime.utcnow()
        job.output_size_bytes = os.path.getsize(media_item.path)
        job.savings_bytes = pre_size - job.output_size_bytes
        job.savings_percent = round((job.savings_bytes / pre_size) * 100, 1) if pre_size > 0 else 0.0

        media_item.size_bytes = job.output_size_bytes
        media_item.optimization_status = "optimized"
        media_item.last_optimized_at = datetime.utcnow()
        media_item.applied_profile_id = profile.id
        media_item.applied_profile_name = profile.name
        if media_item.duration_seconds > 0:
            media_item.mb_per_minute = round((job.output_size_bytes / (1024 * 1024)) / (media_item.duration_seconds / 60.0), 2)

        await session.commit()

        # Send completion alert
        saved_mb = round(job.savings_bytes / (1024 * 1024), 1)
        await notification_service.send_alert(
            title="Remote Optimization Complete",
            message=f"Job #{job.id} completed by {job.assigned_node_name}. Saved {saved_mb} MB ({job.savings_percent}%).",
            event_type="job_completed",
        )

        logger.info(f"Job #{job.id} completed successfully via remote worker. Saved {saved_mb} MB.")
        return {"status": "success", "message": f"Job #{job.id} completed and replaced."}

    except Exception as e:
        logger.error(f"Error finalizing remote job #{job.id}: {e}")
        job.status = "failed"
        job.stage = "failed"
        job.error_message = str(e)
        media_item.optimization_status = "failed"
        await session.commit()

        if os.path.exists(target_work_file):
            try:
                os.remove(target_work_file)
            except OSError:
                pass

        raise HTTPException(status_code=500, detail=str(e))

    finally:
        await event_broadcaster.broadcast("job_status", {"id": job.id, "status": job.status})

@router.post("/jobs/{job_id}/fail")
async def report_job_failure(
    job_id: int,
    error_message: str = Form(...),
    session: AsyncSession = Depends(get_db),
):
    """Handles failure notification from a remote worker node."""
    stmt = select(EncodingJob).where(EncodingJob.id == job_id)
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = "failed"
    job.stage = "failed"
    job.error_message = f"Remote node reported error: {error_message}"

    stmt_media = select(MediaItem).where(MediaItem.id == job.media_item_id)
    media_item = (await session.execute(stmt_media)).scalar_one_or_none()
    if media_item:
        media_item.optimization_status = "failed"

    await session.commit()
    await event_broadcaster.broadcast("job_status", {"id": job.id, "status": "failed"})

    return {"status": "ok"}
