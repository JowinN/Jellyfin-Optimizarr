import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from app.database import get_db, AsyncSessionLocal
from app.models.media import MediaItem
from app.models.user import User
from app.schemas.media import MediaItemOut, MediaDetailOut, ScanTriggerRequest, ScanStatusOut
from app.services.scanner import library_scanner
from app.api.deps import get_current_user

router = APIRouter(prefix="/media", tags=["Media"])

@router.get("", response_model=Dict[str, Any])
async def list_media(
    search: Optional[str] = None,
    library: Optional[str] = None,
    video_codec: Optional[str] = None,
    resolution: Optional[str] = None,
    optimization_status: Optional[str] = None,
    min_mb_per_minute: Optional[float] = None,
    sort_by: str = Query("mb_per_minute", pattern="^(mb_per_minute|size_bytes|duration_seconds|filename)$"),
    sort_desc: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=100),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns paginated, searchable, and filtered media items."""
    query = select(MediaItem)
    conditions = []

    if search:
        search_fmt = f"%{search}%"
        conditions.append(
            or_(
                MediaItem.filename.ilike(search_fmt),
                MediaItem.title.ilike(search_fmt),
                MediaItem.series_name.ilike(search_fmt),
            )
        )

    if library:
        conditions.append(MediaItem.library == library)
    if video_codec:
        conditions.append(MediaItem.video_codec == video_codec)
    if resolution:
        conditions.append(MediaItem.resolution == resolution)
    if optimization_status:
        conditions.append(MediaItem.optimization_status == optimization_status)
    if min_mb_per_minute is not None:
        conditions.append(MediaItem.mb_per_minute >= min_mb_per_minute)

    if conditions:
        query = query.where(and_(*conditions))

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_count = (await session.execute(count_query)).scalar_one()

    # Sort
    col = getattr(MediaItem, sort_by)
    query = query.order_by(col.desc() if sort_desc else col.asc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    res = await session.execute(query)
    items = res.scalars().all()

    return {
        "items": [MediaItemOut.model_validate(item) for item in items],
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size,
    }

@router.get("/{media_id}", response_model=MediaDetailOut)
async def get_media_detail(
    media_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves full technical stream inspection details for a media file."""
    stmt = select(MediaItem).where(MediaItem.id == media_id)
    res = await session.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    return MediaDetailOut.model_validate(item)

@router.post("/scan")
async def trigger_library_scan(
    req: ScanTriggerRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Triggers recursive library scanner in background."""
    if library_scanner.is_scanning:
        return {"message": "Scan already running", "is_scanning": True}

    async def run_scan_task():
        async with AsyncSessionLocal() as session:
            await library_scanner.scan_all(
                session=session,
                force_rescan=req.force_rescan,
                libraries=req.libraries,
            )

    background_tasks.add_task(run_scan_task)
    return {"message": "Library scan initiated in background", "is_scanning": True}

@router.post("/scan/cancel")
async def cancel_library_scan(current_user: User = Depends(get_current_user)):
    """Cancels active library scanner."""
    library_scanner.cancel()
    return {"message": "Scan cancellation requested"}

@router.get("/scan/status", response_model=ScanStatusOut)
async def get_scan_status(current_user: User = Depends(get_current_user)):
    """Queries current scanner progress and file."""
    return ScanStatusOut(
        is_scanning=library_scanner.is_scanning,
        current_library=library_scanner.current_library,
        current_file=library_scanner.current_file,
        scanned_count=library_scanner.scanned_count,
        total_found=library_scanner.total_found,
        errors_count=library_scanner.errors_count,
    )

@router.post("/prune")
async def prune_missing_media(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Checks all media items and removes database records for files no longer on disk."""
    count = await library_scanner.prune_missing_files(session)
    return {"message": f"Successfully pruned {count} removed items from database.", "pruned_count": count}
