from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.schemas.job import DryRunResultOut
from app.services.recommendation_engine import recommendation_engine
from app.api.deps import get_current_user

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.get("", response_model=List[Dict[str, Any]])
async def get_recommendations(
    library: Optional[str] = None,
    min_mb_per_minute: Optional[float] = None,
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyzes media library and returns ranked list of candidate files worth optimizing."""
    candidates = await recommendation_engine.analyze_candidates(
        session=session,
        library=library,
        min_mb_per_minute=min_mb_per_minute,
        limit=limit,
    )
    return candidates

@router.post("/dry-run", response_model=DryRunResultOut)
async def generate_dry_run(
    media_item_id: int = Query(...),
    profile_id: int = Query(...),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates dry-run simulation of encoding: projected size, savings, FFmpeg args, and risk warnings."""
    plan = await recommendation_engine.generate_dry_run_plan(
        session=session,
        media_item_id=media_item_id,
        profile_id=profile_id,
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Media item not found or dry-run failed")
    return DryRunResultOut(**plan)
