"""Field-level encryption for sensitive text stored at rest.

SMBs are nervous about financial data, so free-text identifiers (customer /
vendor names, note fields) are encrypted with Fernet (AES-128-CBC + HMAC)
before they touch the database.

Behaviour:
  * ``DATA_ENCRYPTION_KEY`` set  -> values are encrypted; ciphertext is prefixed
    with ``enc:v1:`` so we can tell encrypted from legacy/plaintext values.
  * ``DATA_ENCRYPTION_KEY`` empty -> passthrough (dev convenience only) with a
    one-time warning. Never rely on this in production.

Decryption is tolerant: a value without the prefix is returned unchanged, so
turning encryption on later doesn't break rows written before the key existed.
"""
from __future__ import annotations

import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

logger = logging.getLogger(__name__)

_PREFIX = "enc:v1:"


@lru_cache(maxsize=1)
def _fernet() -> Fernet | None:
    key = get_settings().data_encryption_key.strip()
    if not key:
        logger.warning(
            "DATA_ENCRYPTION_KEY is not set — sensitive fields are stored in plaintext. "
            "Set a Fernet key before handling real customer data."
        )
        return None
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:
        logger.error("DATA_ENCRYPTION_KEY is invalid (%s); storing fields in plaintext.", exc)
        return None


def is_enabled() -> bool:
    return _fernet() is not None


def encrypt(value: str | None) -> str | None:
    """Encrypt a string. Returns None unchanged; passthrough when no key set."""
    if value is None:
        return None
    f = _fernet()
    if f is None:
        return value
    return _PREFIX + f.encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    """Decrypt a value produced by :func:`encrypt`. Plaintext is returned as-is."""
    if value is None or not value.startswith(_PREFIX):
        return value
    f = _fernet()
    if f is None:
        # Key was removed after data was encrypted — we cannot recover it.
        return None
    try:
        return f.decrypt(value[len(_PREFIX) :].encode()).decode()
    except InvalidToken:
        logger.error("Failed to decrypt a field (wrong key?).")
        return None
