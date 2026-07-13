"""Auth endpoints: register, login, current user, MFA."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app import store
from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.schemas import TokenResponse, UserCreate, UserLogin, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_public(user: dict) -> UserPublic:
    created = user["created_at"]
    return UserPublic(
        id=user["id"],
        email=user["email"],
        created_at=created if isinstance(created, datetime) else datetime.fromisoformat(created),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate) -> TokenResponse:
    if store.get_user_by_email(body.email) is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    try:
        user = store.create_user(body.email, hash_password(body.password))
    except IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    token = create_access_token(user["id"])
    store.record_audit("auth.register", user_id=user["id"])
    return TokenResponse(access_token=token, user=_to_public(user))


@router.post("/login")
def login(body: UserLogin, bg: BackgroundTasks):
    """
    Login with email + password.
    If MFA is enabled returns {mfa_required: true, mfa_token, method} instead of a
    full access token. The client must then POST to /api/auth/mfa/verify.
    """
    from app.otp_helpers import create_mfa_token, generate_email_otp, hash_otp_code
    from app.notifications.email import send_otp_email

    user = store.get_user_by_email(body.email)
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    mfa = store.get_user_mfa(user["id"]) or {}
    totp_on  = bool(mfa.get("totp_enabled"))
    email_on = bool(mfa.get("email_otp_enabled"))

    if totp_on or email_on:
        mfa_token = create_mfa_token(user["id"])
        method    = "totp" if totp_on else "email_otp"
        if email_on and not totp_on:
            # Generate and email the OTP in the background
            code = generate_email_otp()
            code_hash = hash_otp_code(code)
            expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
            store.save_otp_code(
                id=uuid.uuid4().hex[:12],
                user_id=user["id"],
                code_hash=code_hash,
                expires_at=expires,
            )
            bg.add_task(send_otp_email, user["email"], code)
        store.record_audit("auth.login.mfa_required", user_id=user["id"])
        return {"mfa_required": True, "mfa_token": mfa_token, "method": method}

    token = create_access_token(user["id"])
    store.record_audit("auth.login", user_id=user["id"])
    return TokenResponse(access_token=token, user=_to_public(user))


@router.get("/me", response_model=UserPublic)
def me(user: dict = Depends(get_current_user)) -> UserPublic:
    return _to_public(user)


@router.get("/me/audit")
def my_audit(user: dict = Depends(get_current_user)) -> list[dict]:
    """Return the signed-in user's own recent account activity (transparency)."""
    return store.list_audit(user["id"], limit=100)
