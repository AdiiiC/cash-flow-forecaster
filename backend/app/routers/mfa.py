"""
MFA / OTP router — extends the existing /api/auth prefix.

Endpoints:
  POST   /api/auth/mfa/totp/setup        — generate TOTP secret + QR code
  POST   /api/auth/mfa/totp/enable       — verify first code → activate + return backup codes
  DELETE /api/auth/mfa/totp              — disable TOTP

  POST   /api/auth/mfa/email-otp/enable  — enable email-OTP for login
  DELETE /api/auth/mfa/email-otp         — disable email-OTP

  GET    /api/auth/mfa/status            — whether MFA is enabled and which methods

  POST   /api/auth/mfa/verify            — exchange mfa_token + code for full JWT
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from app import store
from app.auth import (
    create_access_token,
    get_current_user,
    verify_password,
)
from app.otp_helpers import (
    create_mfa_token,
    generate_backup_codes,
    generate_email_otp,
    generate_totp_secret,
    hash_backup_code,
    hash_otp_code,
    totp_qr_base64,
    totp_provisioning_uri,
    verify_backup_code,
    verify_mfa_token,
    verify_otp_code,
    verify_totp,
)
from app.notifications.email import send_otp_email
from app.security.crypto import encrypt, decrypt

router = APIRouter(prefix="/auth/mfa", tags=["mfa"])


def _to_public_user(user: dict):
    from app.schemas import UserPublic
    created = user["created_at"]
    return UserPublic(
        id=user["id"],
        email=user["email"],
        created_at=created if isinstance(created, datetime) else datetime.fromisoformat(created),
    )


# ── TOTP setup ─────────────────────────────────────────────────────────────────

class TotpSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str


@router.post("/totp/setup", response_model=TotpSetupResponse)
def totp_setup(user: dict = Depends(get_current_user)) -> TotpSetupResponse:
    """Generate a new TOTP secret and QR code. Does NOT enable TOTP yet."""
    mfa = store.get_user_mfa(user["id"])
    if mfa and mfa.get("totp_enabled"):
        raise HTTPException(400, "TOTP is already enabled. Disable it first.")
    secret = generate_totp_secret()
    enc_secret = encrypt(secret)
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_user_mfa(user["id"], {"totp_secret": enc_secret, "updated_at": now})
    return TotpSetupResponse(
        secret=secret,
        provisioning_uri=totp_provisioning_uri(secret, user["email"]),
        qr_code_base64=totp_qr_base64(secret, user["email"]),
    )


class TotpEnableBody(BaseModel):
    code: str


class TotpEnableResponse(BaseModel):
    backup_codes: list[str]
    message: str


@router.post("/totp/enable", response_model=TotpEnableResponse)
def totp_enable(body: TotpEnableBody, user: dict = Depends(get_current_user)):
    """Verify the TOTP code once to confirm device is working, then activate."""
    mfa = store.get_user_mfa(user["id"])
    if not mfa or not mfa.get("totp_secret"):
        raise HTTPException(400, "Run /mfa/totp/setup first.")
    secret = decrypt(mfa["totp_secret"])
    if not verify_totp(secret, body.code.strip()):
        raise HTTPException(400, "Invalid TOTP code. Check your authenticator app.")
    codes = generate_backup_codes(8)
    hashed = [hash_backup_code(c) for c in codes]
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_user_mfa(user["id"], {
        "totp_enabled":  1,
        "backup_codes":  json.dumps(hashed),
        "updated_at":    now,
    })
    store.record_audit("auth.mfa.totp.enabled", user_id=user["id"])
    return TotpEnableResponse(
        backup_codes=codes,
        message="TOTP enabled. Store your backup codes somewhere safe.",
    )


@router.delete("/totp", status_code=204)
def totp_disable(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_user_mfa(user["id"], {
        "totp_secret":  None,
        "totp_enabled": 0,
        "backup_codes": None,
        "updated_at":   now,
    })
    store.record_audit("auth.mfa.totp.disabled", user_id=user["id"])


# ── Email OTP ──────────────────────────────────────────────────────────────────

@router.post("/email-otp/enable", status_code=200)
def email_otp_enable(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_user_mfa(user["id"], {"email_otp_enabled": 1, "updated_at": now})
    store.record_audit("auth.mfa.email_otp.enabled", user_id=user["id"])
    return {"message": "Email OTP enabled for future logins."}


@router.delete("/email-otp", status_code=204)
def email_otp_disable(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_user_mfa(user["id"], {"email_otp_enabled": 0, "updated_at": now})
    store.record_audit("auth.mfa.email_otp.disabled", user_id=user["id"])


# ── MFA status ─────────────────────────────────────────────────────────────────

class MfaStatus(BaseModel):
    totp_enabled: bool
    email_otp_enabled: bool


@router.get("/status", response_model=MfaStatus)
def mfa_status(user: dict = Depends(get_current_user)) -> MfaStatus:
    mfa = store.get_user_mfa(user["id"]) or {}
    return MfaStatus(
        totp_enabled=bool(mfa.get("totp_enabled")),
        email_otp_enabled=bool(mfa.get("email_otp_enabled")),
    )


# ── Verify MFA code (exchange mfa_token for full JWT) ─────────────────────────

class MfaVerifyBody(BaseModel):
    mfa_token: str
    code: str


@router.post("/verify")
def mfa_verify(body: MfaVerifyBody, bg: BackgroundTasks):
    """
    Validates the short-lived mfa_token from /login and the OTP code.
    Returns a full access token on success.
    """
    user_id = verify_mfa_token(body.mfa_token)
    if not user_id:
        raise HTTPException(401, "Invalid or expired MFA session. Please log in again.")

    user = store.get_user_by_id(user_id)
    if not user:
        raise HTTPException(401, "User not found.")

    mfa = store.get_user_mfa(user_id) or {}
    code = body.code.strip().replace(" ", "")
    authenticated = False

    # Try TOTP
    if mfa.get("totp_enabled") and mfa.get("totp_secret"):
        secret = decrypt(mfa["totp_secret"])
        if verify_totp(secret, code):
            authenticated = True

    # Try email OTP (stored in otp_codes table)
    if not authenticated and mfa.get("email_otp_enabled"):
        otp_row = store.get_latest_otp_code(user_id)
        if otp_row and not otp_row["used"]:
            expires = datetime.fromisoformat(otp_row["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) <= expires:
                if verify_otp_code(code, otp_row["code_hash"]):
                    store.mark_otp_used(otp_row["id"])
                    authenticated = True

    # Try backup code
    if not authenticated and mfa.get("backup_codes"):
        hashed_list: list[str] = json.loads(mfa["backup_codes"])
        for i, h in enumerate(hashed_list):
            if verify_backup_code(code, h):
                hashed_list.pop(i)
                store.upsert_user_mfa(user_id, {
                    "backup_codes": json.dumps(hashed_list),
                    "updated_at":   datetime.now(timezone.utc).isoformat(),
                })
                authenticated = True
                break

    if not authenticated:
        store.record_audit("auth.mfa.failed", user_id=user_id)
        raise HTTPException(401, "Invalid verification code.")

    store.record_audit("auth.mfa.success", user_id=user_id)
    from app.schemas import TokenResponse
    return TokenResponse(
        access_token=create_access_token(user_id),
        user=_to_public_user(user),
    )
