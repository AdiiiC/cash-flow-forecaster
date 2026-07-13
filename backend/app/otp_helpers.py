"""
MFA / OTP additions to the auth module.

Adds:
  - Short-lived "MFA pending" token (5 min, scope=mfa_pending)
  - TOTP helpers (pyotp / Google Authenticator style)
  - Email OTP helpers (6-digit, bcrypt-hashed, 10-min TTL)
  - Backup codes (8 codes, bcrypt-hashed)
"""
from __future__ import annotations

import base64
import hashlib
import io
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import pyotp
import qrcode
import qrcode.image.svg

from app.config import get_settings

_ALGORITHM = "HS256"
_MFA_SCOPE  = "mfa_pending"


# ── MFA pending token ──────────────────────────────────────────────────────────
def create_mfa_token(user_id: str) -> str:
    """Short-lived JWT (5 min) granting access to /api/auth/mfa/verify only."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub":   user_id,
        "scope": _MFA_SCOPE,
        "iat":   int(now.timestamp()),
        "exp":   int((now + timedelta(minutes=5)).timestamp()),
    }
    return jwt.encode(payload, settings.effective_jwt_secret, algorithm=_ALGORITHM)


def verify_mfa_token(token: str) -> str | None:
    """
    Decode and validate a MFA-pending token.
    Returns user_id if valid, None otherwise.
    """
    try:
        payload = jwt.decode(
            token, get_settings().effective_jwt_secret, algorithms=[_ALGORITHM]
        )
        if payload.get("scope") != _MFA_SCOPE:
            return None
        sub = payload.get("sub")
        return str(sub) if sub else None
    except jwt.PyJWTError:
        return None


# ── TOTP (Time-based OTP — Google Authenticator compatible) ───────────────────
def generate_totp_secret() -> str:
    """Return a new random base32 TOTP secret (160-bit)."""
    return pyotp.random_base32()


def totp_provisioning_uri(secret: str, email: str, issuer: str = "ClearCash") -> str:
    """Return the otpauth:// URI for QR code generation."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def totp_qr_base64(secret: str, email: str) -> str:
    """Return a base64-encoded PNG QR code for the TOTP provisioning URI."""
    uri = totp_provisioning_uri(secret, email)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code against the stored secret (±1 window for clock drift)."""
    try:
        return pyotp.TOTP(secret).verify(code, valid_window=1)
    except Exception:
        return False


# ── Backup codes ───────────────────────────────────────────────────────────────
def generate_backup_codes(count: int = 8) -> list[str]:
    """Generate human-friendly backup codes (e.g. XXXX-XXXX format)."""
    codes = []
    for _ in range(count):
        raw = secrets.token_hex(4).upper()
        codes.append(f"{raw[:4]}-{raw[4:]}")
    return codes


def hash_backup_code(code: str) -> str:
    normalised = code.replace("-", "").upper()
    return bcrypt.hashpw(normalised.encode(), bcrypt.gensalt()).decode()


def verify_backup_code(code: str, hashed: str) -> bool:
    try:
        normalised = code.replace("-", "").upper()
        return bcrypt.checkpw(normalised.encode(), hashed.encode())
    except Exception:
        return False


# ── Email OTP ──────────────────────────────────────────────────────────────────
def generate_email_otp() -> str:
    """Generate a 6-digit OTP code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp_code(code: str) -> str:
    return bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()


def verify_otp_code(code: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(code.encode(), hashed.encode())
    except Exception:
        return False
