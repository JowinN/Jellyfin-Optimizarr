from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    is_admin: bool

class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

class SetupRequest(BaseModel):
    admin_username: str = Field(..., min_length=3, max_length=64)
    admin_password: str = Field(..., min_length=8)
    jellyfin_url: str = "http://jellyfin:8096"
    jellyfin_api_key: Optional[str] = ""

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)
