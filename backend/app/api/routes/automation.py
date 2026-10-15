from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, case
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.automation import AutomationRule
from app.models.media import MediaItem
from app.models.profile import EncodingProfile
from app.models.user import User
from app.schemas.automation import (
    AutomationRuleCreate,
    AutomationRuleUpdate,
    AutomationRuleOut,
    AutomationSeriesOut,
    AutomationLibraryOut,
    AutomationEvaluateResult,
)
from app.services.automation_service import automation_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/automation", tags=["Automation"])

def map_rule_to_out(rule: AutomationRule) -> AutomationRuleOut:
    return AutomationRuleOut(
        id=rule.id,
        name=rule.name,
        scope_type=rule.scope_type,
        target_library=rule.target_library,
        target_series_name=rule.target_series_name,
        profile_id=rule.profile_id,
        profile_name=rule.profile.name if rule.profile else None,
        video_codec=rule.profile.video_codec if rule.profile else None,
        assigned_node_id=rule.assigned_node_id,
        assigned_node_name=rule.assigned_node_name,
        replacement_mode=rule.replacement_mode,
        priority=rule.priority,
        is_active=rule.is_active,
        auto_encode_new=rule.auto_encode_new,
        auto_encode_existing=rule.auto_encode_existing,
        last_run_at=rule.last_run_at,
        matched_count=rule.matched_count,
        queued_count=rule.queued_count,
        completed_count=rule.completed_count,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )

@router.get("/rules", response_model=List[AutomationRuleOut])
async def list_rules(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all scheduled automation rules."""
    stmt = (
        select(AutomationRule)
        .options(selectinload(AutomationRule.profile))
        .order_by(AutomationRule.priority.desc(), AutomationRule.created_at.desc())
    )
    res = await session.execute(stmt)
    rules = res.scalars().all()
    return [map_rule_to_out(r) for r in rules]

@router.post("/rules", response_model=AutomationRuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(
    req: AutomationRuleCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new automation rule and optionally evaluate existing media immediately."""
    # Verify profile exists
    prof_stmt = select(EncodingProfile).where(EncodingProfile.id == req.profile_id)
    profile = (await session.execute(prof_stmt)).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=400, detail="Invalid profile_id: profile not found")

    data = req.model_dump()
    rule = AutomationRule(**data)
    session.add(rule)
    await session.commit()
    await session.refresh(rule)

    # Immediately evaluate existing items if enabled
    if rule.auto_encode_existing and rule.is_active:
        await automation_service.evaluate_rule(session, rule.id)
        # Refresh to get updated counts
        await session.refresh(rule)

    # Re-fetch with loaded profile relationship
    stmt = select(AutomationRule).options(selectinload(AutomationRule.profile)).where(AutomationRule.id == rule.id)
    rule_with_profile = (await session.execute(stmt)).scalar_one()

    return map_rule_to_out(rule_with_profile)

@router.get("/rules/{rule_id}", response_model=AutomationRuleOut)
async def get_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(AutomationRule).options(selectinload(AutomationRule.profile)).where(AutomationRule.id == rule_id)
    rule = (await session.execute(stmt)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return map_rule_to_out(rule)

@router.put("/rules/{rule_id}", response_model=AutomationRuleOut)
async def update_rule(
    rule_id: int,
    req: AutomationRuleUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(AutomationRule).options(selectinload(AutomationRule.profile)).where(AutomationRule.id == rule_id)
    rule = (await session.execute(stmt)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    update_data = req.model_dump(exclude_unset=True)
    if "profile_id" in update_data and update_data["profile_id"] is not None:
        prof_stmt = select(EncodingProfile).where(EncodingProfile.id == update_data["profile_id"])
        profile = (await session.execute(prof_stmt)).scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=400, detail="Invalid profile_id")

    for k, v in update_data.items():
        setattr(rule, k, v)

    await session.commit()
    await session.refresh(rule)

    # If it was reactivated or edited with auto_encode_existing, re-evaluate
    if rule.is_active and rule.auto_encode_existing:
        await automation_service.evaluate_rule(session, rule.id)
        await session.refresh(rule)

    # Re-fetch with profile
    stmt = select(AutomationRule).options(selectinload(AutomationRule.profile)).where(AutomationRule.id == rule.id)
    rule_with_profile = (await session.execute(stmt)).scalar_one()

    return map_rule_to_out(rule_with_profile)

@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(AutomationRule).where(AutomationRule.id == rule_id)
    rule = (await session.execute(stmt)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await session.delete(rule)
    await session.commit()
    return {"message": f"Automation rule '{rule.name}' deleted successfully"}

@router.post("/rules/{rule_id}/run", response_model=AutomationEvaluateResult)
async def run_rule_now(
    rule_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Triggers an immediate evaluation and catch-up encoding run for a specific rule."""
    result = await automation_service.evaluate_rule(session, rule_id)
    return AutomationEvaluateResult(**result)

@router.post("/evaluate", response_model=List[AutomationEvaluateResult])
async def evaluate_all_rules_now(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Triggers immediate evaluation for all enabled rules."""
    results = await automation_service.evaluate_all_active_rules(session)
    return [AutomationEvaluateResult(**r) for r in results]

@router.get("/series", response_model=List[AutomationSeriesOut])
async def list_available_series(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all available distinct series in the media library with episode counts."""
    stmt = (
        select(
            MediaItem.series_name,
            MediaItem.library,
            func.count(MediaItem.id).label("total_episodes"),
            func.sum(
                case(
                    (MediaItem.optimization_status.in_(["unoptimized", "failed"]), 1),
                    else_=0
                )
            ).label("unoptimized_episodes")
        )
        .where(MediaItem.series_name.isnot(None), MediaItem.series_name != "")
        .group_by(MediaItem.series_name, MediaItem.library)
        .order_by(MediaItem.series_name.asc())
    )
    res = await session.execute(stmt)
    rows = res.all()
    return [
        AutomationSeriesOut(
            series_name=r[0],
            library=r[1] or "tv",
            total_episodes=r[2],
            unoptimized_episodes=r[3] or 0
        )
        for r in rows
    ]

@router.get("/libraries", response_model=List[AutomationLibraryOut])
async def list_available_libraries(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all available libraries with media counts."""
    stmt = (
        select(
            MediaItem.library,
            func.count(MediaItem.id).label("total_items"),
            func.sum(
                case(
                    (MediaItem.optimization_status.in_(["unoptimized", "failed"]), 1),
                    else_=0
                )
            ).label("unoptimized_items")
        )
        .where(MediaItem.library.isnot(None), MediaItem.library != "")
        .group_by(MediaItem.library)
        .order_by(MediaItem.library.asc())
    )
    res = await session.execute(stmt)
    rows = res.all()
    return [
        AutomationLibraryOut(
            library=r[0],
            total_items=r[1],
            unoptimized_items=r[2] or 0
        )
        for r in rows
    ]
