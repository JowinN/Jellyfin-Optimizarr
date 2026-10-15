import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.rollback import RollbackRecord
from app.models.user import User
from app.schemas.rollback import RollbackRecordOut, RollbackRestoreRequest
from app.services.replacement_manager import replacement_manager
from app.api.deps import get_current_user

router = APIRouter(prefix="/rollback", tags=["Rollback & Backups"])

@router.get("", response_model=List[RollbackRecordOut])
async def list_rollback_records(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns audit trail of replaced media and available backups."""
    stmt = select(RollbackRecord).order_by(RollbackRecord.created_at.desc())
    res = await session.execute(stmt)
    records = res.scalars().all()
    return [RollbackRecordOut.model_validate(r) for r in records]

@router.post("/restore-all")
async def restore_all_rollback_records(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restores all available backups back to original media files."""
    stmt = select(RollbackRecord).where(RollbackRecord.status == "available").order_by(RollbackRecord.id.asc())
    res = await session.execute(stmt)
    records = res.scalars().all()

    if not records:
        return {"message": "No available backups to restore.", "restored_count": 0, "failed_count": 0, "errors": []}

    restored_count = 0
    failed_count = 0
    errors = []

    for r in records:
        success, msg = await replacement_manager.rollback(session, r.id)
        if success:
            restored_count += 1
        else:
            failed_count += 1
            errors.append(f"{r.original_path.split('/')[-1]}: {msg}")

    return {
        "message": f"Successfully rolled back {restored_count} media file(s)." + (f" ({failed_count} failed)" if failed_count > 0 else ""),
        "restored_count": restored_count,
        "failed_count": failed_count,
        "errors": errors,
    }

@router.post("/purge-all")
@router.delete("/purge-all")
async def purge_all_backups(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently purges all available backup files from disk to reclaim storage."""
    stmt = select(RollbackRecord).where(RollbackRecord.status == "available")
    res = await session.execute(stmt)
    records = res.scalars().all()

    if not records:
        return {"message": "No available backups to prune.", "purged_count": 0, "reclaimed_bytes": 0}

    purged_count = 0
    reclaimed_bytes = 0

    for r in records:
        if os.path.exists(r.backup_path):
            try:
                size = os.path.getsize(r.backup_path)
                os.remove(r.backup_path)
                reclaimed_bytes += size
            except OSError as e:
                reclaimed_bytes += (r.original_size_bytes or 0)
        else:
            reclaimed_bytes += (r.original_size_bytes or 0)

        r.status = "purged"
        purged_count += 1

    await session.commit()
    return {
        "message": f"Successfully pruned {purged_count} backup file(s) and reclaimed storage.",
        "purged_count": purged_count,
        "reclaimed_bytes": reclaimed_bytes,
    }

@router.post("/restore")
async def restore_rollback_record(
    req: RollbackRestoreRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restores the original media file from the safety backup."""
    if not req.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required to restore original media file")

    success, message = await replacement_manager.rollback(session, req.record_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return {"message": message, "success": True}

@router.delete("/{record_id}")
async def purge_backup(
    record_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently purges a backup file from disk to reclaim storage."""
    stmt = select(RollbackRecord).where(RollbackRecord.id == record_id)
    res = await session.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Rollback record not found")

    if os.path.exists(record.backup_path):
        try:
            os.remove(record.backup_path)
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete backup file: {e}")

    record.status = "purged"
    await session.commit()
    return {"message": "Backup purged successfully"}
