from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut, SetupRequest, ChangePasswordRequest
from app.core.security import verify_password, get_password_hash, create_access_token
from app.api.deps import get_current_user
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/status")
async def get_auth_status(session: AsyncSession = Depends(get_db)):
    """Checks whether initial admin user has been created."""
    stmt = select(User).limit(1)
    res = await session.execute(stmt)
    has_users = res.scalar_one_or_none() is not None
    return {"needs_setup": not has_users}

@router.post("/setup", response_model=TokenResponse)
async def setup_initial_admin(req: SetupRequest, session: AsyncSession = Depends(get_db)):
    """Initial onboarding wizard: creates first administrator account."""
    stmt = select(User).limit(1)
    res = await session.execute(stmt)
    if res.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System is already configured. Please log in.")

    hashed_pw = get_password_hash(req.admin_password)
    admin_user = User(
        username=req.admin_username,
        hashed_password=hashed_pw,
        is_admin=True,
    )
    session.add(admin_user)
    await session.commit()
    await session.refresh(admin_user)

    token = create_access_token(admin_user.username)
    return TokenResponse(
        access_token=token,
        username=admin_user.username,
        is_admin=True,
    )

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: AsyncSession = Depends(get_db)):
    """Logs in administrator and issues bearer token."""
    stmt = select(User).where(User.username == req.username)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    user.last_login = datetime.utcnow()
    await session.commit()

    token = create_access_token(user.username)
    return TokenResponse(
        access_token=token,
        username=user.username,
        is_admin=user.is_admin,
    )

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns currently authenticated user."""
    return current_user

@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Changes password for active user."""
    stmt = select(User).where(User.id == current_user.id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(req.old_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    user.hashed_password = get_password_hash(req.new_password)
    await session.commit()
    return {"message": "Password changed successfully"}
