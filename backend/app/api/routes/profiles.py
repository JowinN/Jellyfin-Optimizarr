from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.profile import EncodingProfile
from app.models.user import User
from app.schemas.profile import EncodingProfileCreate, EncodingProfileUpdate, EncodingProfileOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/profiles", tags=["Profiles"])

@router.get("", response_model=List[EncodingProfileOut])
async def list_profiles(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all available encoding profiles including presets."""
    stmt = select(EncodingProfile).order_by(EncodingProfile.is_preset.desc(), EncodingProfile.name.asc())
    res = await session.execute(stmt)
    profiles = res.scalars().all()
    return [EncodingProfileOut.model_validate(p) for p in profiles]

@router.get("/{profile_id}", response_model=EncodingProfileOut)
async def get_profile(
    profile_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(EncodingProfile).where(EncodingProfile.id == profile_id)
    res = await session.execute(stmt)
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return EncodingProfileOut.model_validate(profile)

@router.post("", response_model=EncodingProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(
    req: EncodingProfileCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a new custom encoding profile."""
    # Check if name is taken
    stmt = select(EncodingProfile).where(EncodingProfile.name == req.name)
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Profile with name '{req.name}' already exists")

    data = req.model_dump()
    data["is_preset"] = False
    profile = EncodingProfile(**data)
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return EncodingProfileOut.model_validate(profile)

@router.put("/{profile_id}", response_model=EncodingProfileOut)
async def update_profile(
    profile_id: int,
    req: EncodingProfileUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates an existing encoding profile. Presets cannot be renamed."""
    stmt = select(EncodingProfile).where(EncodingProfile.id == profile_id)
    profile = (await session.execute(stmt)).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = req.model_dump(exclude_unset=True)
    if profile.is_preset and "name" in update_data and update_data["name"] != profile.name:
        raise HTTPException(status_code=400, detail="Cannot rename built-in presets")

    for k, v in update_data.items():
        setattr(profile, k, v)

    await session.commit()
    await session.refresh(profile)
    return EncodingProfileOut.model_validate(profile)

@router.delete("/{profile_id}")
async def delete_profile(
    profile_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes profile (both custom and built-in profiles can be deleted)."""
    stmt = select(EncodingProfile).where(EncodingProfile.id == profile_id)
    profile = (await session.execute(stmt)).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    await session.delete(profile)
    await session.commit()
    return {"message": f"Profile '{profile.name}' deleted successfully"}

@router.post("/restore-defaults", response_model=List[EncodingProfileOut])
async def restore_default_presets(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restores any missing default presets."""
    from app.services.profile_manager import profile_manager
    await profile_manager.restore_default_presets(session)
    stmt = select(EncodingProfile).order_by(EncodingProfile.is_preset.desc(), EncodingProfile.name.asc())
    res = await session.execute(stmt)
    profiles = res.scalars().all()
    return [EncodingProfileOut.model_validate(p) for p in profiles]

