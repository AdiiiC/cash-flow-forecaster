"""Self-hosted authentication: bcrypt password hashing + JWT access tokens.

No third-party auth service. Tokens are stateless (signed JWTs); the only
server state is the users table. Keep JWT_SECRET strong and secret in prod.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import store
from app.config import get_settings

_ALGORITHM = "HS256"

# auto_error=False so endpoints can accept anonymous callers (optional auth).
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.effective_jwt_secret, algorithm=_ALGORITHM)


def _decode(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token, get_settings().effective_jwt_secret, algorithms=[_ALGORITHM]
        )
        sub = payload.get("sub")
        return str(sub) if sub else None
    except jwt.PyJWTError:
        return None


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Require a valid token; raise 401 otherwise. Returns the user record."""
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = _decode(creds.credentials)
    user = store.get_user_by_id(user_id) if user_id else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict | None:
    """Return the user if a valid token is present, else None (no error)."""
    if creds is None:
        return None
    user_id = _decode(creds.credentials)
    return store.get_user_by_id(user_id) if user_id else None
