import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete, update
from app.database import get_db
from app.models.job import EncodingJob, JobLog
from app.models.rollback import RollbackRecord
from app.models.media import MediaItem
from app.models.profile import EncodingProfile
from app.models.user import User
from app.schemas.job import JobCreate, JobBatchCreate, JobOut, JobDetailOut
from app.services.queue_worker import queue_worker
from app.api.deps import get_current_user
from app.core.events import event_broadcaster

router = APIRouter(prefix="/queue", tags=["Queue"])

@router.get("", response_model=List[JobOut])
async def list_jobs(
    status_filter: Optional[str] = Query(None, pattern="^(pending|running|completed|failed|cancelled)$"),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns queue jobs ordered by priority and execution date."""
    query = select(EncodingJob)
    if status_filter:
        query = query.where(EncodingJob.status == status_filter)

    query = query.order_by(EncodingJob.priority.desc(), EncodingJob.created_at.desc()).limit(limit)
    res = await session.execute(query)
    jobs = res.scalars().all()
    return [JobOut.model_validate(j) for j in jobs]

@router.get("/{job_id}", response_model=JobDetailOut)
async def get_job_detail(
    job_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(EncodingJob).where(EncodingJob.id == job_id)
    res = await session.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobDetailOut.model_validate(job)

@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def enqueue_job(
    req: JobCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adds a media item to the persistent optimization queue."""
    # Validate media item
    stmt_media = select(MediaItem).where(MediaItem.id == req.media_item_id)
    media_item = (await session.execute(stmt_media)).scalar_one_or_none()
    if not media_item:
        raise HTTPException(status_code=404, detail="Media item not found")

    # Prevent duplicate active jobs on same media item
    stmt_existing = select(EncodingJob).where(
        and_(
            EncodingJob.media_item_id == req.media_item_id,
            EncodingJob.status.in_(["pending", "running", "validating", "replacing"]),
        )
    )
    existing_job = (await session.execute(stmt_existing)).scalar_one_or_none()
    if existing_job:
        raise HTTPException(status_code=400, detail=f"Job #{existing_job.id} is already queued or running for this file")

    # Prevent enqueuing if already optimized
    stmt_completed = select(EncodingJob.id).where(
        and_(
            EncodingJob.media_item_id == req.media_item_id,
            EncodingJob.status == "completed",
        )
    ).limit(1)
    has_completed = (await session.execute(stmt_completed)).scalar_one_or_none()
    if (has_completed or media_item.optimization_status == "optimized") and not getattr(req, "force", False):
        raise HTTPException(
            status_code=400,
            detail=f"This file was already optimized (Job #{has_completed or 'earlier'}). Pass force=true to re-encode.",
        )

    # Validate profile
    stmt_prof = select(EncodingProfile).where(EncodingProfile.id == req.profile_id)
    profile = (await session.execute(stmt_prof)).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Encoding profile not found")

    assigned_node = req.assigned_node_id or profile.preferred_node_id
    assigned_name = "Windows PC (Quadro K620)" if assigned_node == "windows-node" else ("Ubuntu Server (Local)" if assigned_node == "local" else None)

    job = EncodingJob(
        media_item_id=media_item.id,
        profile_id=profile.id,
        status="pending",
        stage="queued",
        priority=req.priority,
        is_dry_run=req.is_dry_run,
        source_path=media_item.path,
        replacement_mode=req.replacement_mode,
        source_size_bytes=media_item.size_bytes,
        assigned_node_id=assigned_node,
        assigned_node_name=assigned_name,
    )
    session.add(job)
    media_item.optimization_status = "queued"
    await session.commit()
    await session.refresh(job)

    return JobOut.model_validate(job)

@router.post("/batch", response_model=List[JobOut], status_code=status.HTTP_201_CREATED)
async def enqueue_batch(
    req: JobBatchCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enqueues multiple media items for sequential background optimization."""
    stmt_prof = select(EncodingProfile).where(EncodingProfile.id == req.profile_id)
    profile = (await session.execute(stmt_prof)).scalar_one_or_none()
    assigned_node = req.assigned_node_id or (profile.preferred_node_id if profile else None)
    assigned_name = "Windows PC (Quadro K620)" if assigned_node == "windows-node" else ("Ubuntu Server (Local)" if assigned_node == "local" else None)

    created_jobs = []
    for mid in req.media_item_ids:
        stmt_media = select(MediaItem).where(MediaItem.id == mid)
        media_item = (await session.execute(stmt_media)).scalar_one_or_none()
        if not media_item:
            continue

        # Skip if already optimized
        if media_item.optimization_status == "optimized":
            continue

        # Skip if already completed or actively queued/running
        stmt_existing = select(EncodingJob.id).where(
            and_(
                EncodingJob.media_item_id == mid,
                EncodingJob.status.in_(["pending", "running", "completed"]),
            )
        ).limit(1)
        if (await session.execute(stmt_existing)).scalar_one_or_none():
            continue

        job = EncodingJob(
            media_item_id=mid,
            profile_id=req.profile_id,
            status="pending",
            stage="queued",
            priority=req.priority,
            is_dry_run=req.is_dry_run,
            source_path=media_item.path,
            replacement_mode=req.replacement_mode,
            source_size_bytes=media_item.size_bytes,
            assigned_node_id=assigned_node,
            assigned_node_name=assigned_name,
        )
        session.add(job)
        media_item.optimization_status = "queued"
        created_jobs.append(job)

    await session.commit()
    for j in created_jobs:
        await session.refresh(j)

    return [JobOut.model_validate(j) for j in created_jobs]

@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancels a pending or running job cleanly."""
    stmt = select(EncodingJob).where(EncodingJob.id == job_id)
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == "running":
        await queue_worker.cancel_current_job()

    job.status = "cancelled"
    job.stage = "cancelled"
    job.error_message = "Cancelled by user"

    # Reset media item state
    stmt_media = select(MediaItem).where(MediaItem.id == job.media_item_id)
    item = (await session.execute(stmt_media)).scalar_one_or_none()
    if item and item.optimization_status in ("queued", "processing"):
        item.optimization_status = "optimized" if item.last_optimized_at else "unoptimized"

    await session.commit()
    await event_broadcaster.broadcast("job_status", {
        "id": job.id,
        "status": "cancelled",
        "stage": "cancelled",
        "error_message": "Cancelled by user",
    })
    return {"message": f"Job {job_id} cancelled"}

@router.post("/{job_id}/retry")
async def retry_job(
    job_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resets a failed job to pending."""
    stmt = select(EncodingJob).where(EncodingJob.id == job_id)
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if media item has already completed via another job
    stmt_completed = select(EncodingJob.id).where(
        and_(
            EncodingJob.media_item_id == job.media_item_id,
            EncodingJob.id != job.id,
            EncodingJob.status == "completed",
        )
    ).limit(1)
    has_completed = (await session.execute(stmt_completed)).scalar_one_or_none()
    if has_completed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry Job #{job_id}: Media item was already successfully optimized by Job #{has_completed}.",
        )

    job.status = "pending"
    job.stage = "queued"
    job.error_message = None
    job.progress_percent = 0.0
    job.started_at = None
    job.completed_at = None
    job.retry_count += 1
    await session.commit()
    return {"message": f"Job {job_id} re-queued for execution"}

@router.post("/pause")
async def pause_queue(current_user: User = Depends(get_current_user)):
    queue_worker.pause()
    return {"message": "Queue paused"}

@router.post("/resume")
async def resume_queue(current_user: User = Depends(get_current_user)):
    queue_worker.resume()
    return {"message": "Queue resumed"}

@router.delete("/{job_id}")
async def delete_job(
    job_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes an individual job from the queue and cleans up resources."""
    stmt = select(EncodingJob).where(EncodingJob.id == job_id)
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == "running":
        await queue_worker.cancel_current_job()

    # Reset media item state if not already optimized
    stmt_media = select(MediaItem).where(MediaItem.id == job.media_item_id)
    item = (await session.execute(stmt_media)).scalar_one_or_none()
    if item and item.optimization_status in ("queued", "processing", "failed"):
        item.optimization_status = "optimized" if item.last_optimized_at else "unoptimized"

    # Clean up temporary encoded file if exists
    if job.temp_output_path and os.path.exists(job.temp_output_path):
        try:
            os.remove(job.temp_output_path)
        except OSError:
            pass

    # Unlink rollback records so safety backups are preserved
    await session.execute(
        update(RollbackRecord).where(RollbackRecord.job_id == job_id).values(job_id=None)
    )

    # Delete child job logs
    await session.execute(
        delete(JobLog).where(JobLog.job_id == job_id)
    )

    await session.delete(job)
    await session.commit()
    return {"message": f"Job {job_id} deleted from queue"}

@router.delete("/completed")
async def clear_completed_jobs(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Purges finished, cancelled, and failed job records."""
    stmt_ids = select(EncodingJob.id).where(EncodingJob.status.in_(["completed", "cancelled", "failed"]))
    res = await session.execute(stmt_ids)
    target_ids = res.scalars().all()
    if target_ids:
        # Unlink rollback records so safety backups are preserved
        await session.execute(
            update(RollbackRecord).where(RollbackRecord.job_id.in_(target_ids)).values(job_id=None)
        )

        # Delete child job logs for these jobs
        await session.execute(
            delete(JobLog).where(JobLog.job_id.in_(target_ids))
        )

        # Delete completed/cancelled/failed jobs
        stmt = delete(EncodingJob).where(EncodingJob.id.in_(target_ids))
        await session.execute(stmt)
        await session.commit()
    return {"message": "Completed, cancelled, and failed jobs cleared from history"}

@router.post("/clear-all")
async def clear_all_jobs(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancels running process and clears all jobs from queue, resetting media items."""
    if queue_worker._current_process:
        await queue_worker.cancel_current_job()

    # Reset all affected media items
    stmt_media = select(MediaItem).where(MediaItem.optimization_status.in_(["queued", "processing", "failed"]))
    res = await session.execute(stmt_media)
    for m in res.scalars().all():
        m.optimization_status = "optimized" if m.last_optimized_at else "unoptimized"

    # Clean up temporary encoded files for uncompleted jobs
    stmt_jobs = select(EncodingJob).where(EncodingJob.status.in_(["pending", "running", "paused"]))
    res_jobs = await session.execute(stmt_jobs)
    for j in res_jobs.scalars().all():
        if j.temp_output_path and os.path.exists(j.temp_output_path):
            try:
                os.remove(j.temp_output_path)
            except OSError:
                pass

    # Unlink all rollback records so safety backups are preserved
    await session.execute(update(RollbackRecord).values(job_id=None))

    # Delete all job logs
    await session.execute(delete(JobLog))

    # Delete all jobs
    await session.execute(delete(EncodingJob))
    await session.commit()
    return {"message": "All jobs cleared and media items reset to unoptimized"}
