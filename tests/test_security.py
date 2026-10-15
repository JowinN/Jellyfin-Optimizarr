import pytest
from fastapi import HTTPException
from app.core.security import (
    validate_safe_path,
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
)

def test_password_hashing():
    pw = "SuperSecurePassword123!"
    hashed = get_password_hash(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)
    assert not verify_password("WrongPassword", hashed)

def test_jwt_token_flow():
    user = "jellyfin_admin"
    token = create_access_token(user)
    assert isinstance(token, str)
    decoded = decode_access_token(token)
    assert decoded == user

def test_jwt_invalid_token():
    assert decode_access_token("invalid.token.structure") is None

def test_path_traversal_protection():
    # Outside paths must be rejected with 403 Forbidden
    with pytest.raises(HTTPException) as exc:
        validate_safe_path("/etc/shadow")
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        validate_safe_path("../../var/log/syslog")
    assert exc.value.status_code == 403

    # Forbidden access to Jellyfin config directory
    with pytest.raises(HTTPException) as exc:
        validate_safe_path("/data/media/config/jellyfin/system.xml")
    assert exc.value.status_code == 403

    # Valid media directory paths must succeed
    valid_path = validate_safe_path("/movies/Inception.2010.mkv")
    assert "movies" in valid_path
