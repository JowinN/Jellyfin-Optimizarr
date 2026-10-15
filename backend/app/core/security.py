import os
from datetime import datetime, timedelta
from typing import Optional, Union, Any
import bcrypt
from jose import jwt, JWTError
from fastapi import HTTPException, status
from app.config import settings

ALGORITHM = "HS256"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pw_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pw_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

def validate_safe_path(target_path: str) -> str:
    """
    Validates that target_path is within authorized directories (/movies, /tv, /anime, /work, /backups).
    Prevents path traversal attacks (e.g. ../../etc/passwd or /config/jellyfin).
    Returns normalized absolute path.
    """
    if not target_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path cannot be empty")

    normalized = os.path.abspath(target_path)
    allowed_roots = settings.allowed_media_paths

    is_allowed = any(
        normalized == root or normalized.startswith(root + os.sep)
        for root in allowed_roots
    )

    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: path '{target_path}' is outside authorized media directories"
        )

    return normalized
