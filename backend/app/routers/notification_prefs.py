"""Notification preferences router.

GET  /api/notification-prefs  — get preferences
PUT  /api/notification-prefs  — save preferences
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app import store
from app.auth import get_current_user

router = APIRouter(prefix="/notification-prefs", tags=["notifications"])


class NotificationPrefs(BaseModel):
    email_digest_enabled: bool = True
    digest_cadence: str = "weekly"       # weekly | monthly
    digest_day: int = 1                  # 0=Mon
    slack_enabled: bool = True
    webhook_enabled: bool = True


@router.get("")
def get_prefs(user: dict = Depends(get_current_user)):
    prefs = store.get_notification_prefs(user["id"])
    if not prefs:
        return NotificationPrefs().model_dump()
    return {
        "email_digest_enabled": bool(prefs["email_digest_enabled"]),
        "digest_cadence":       prefs["digest_cadence"],
        "digest_day":           prefs["digest_day"],
        "slack_enabled":        bool(prefs["slack_enabled"]),
        "webhook_enabled":      bool(prefs["webhook_enabled"]),
    }


@router.put("")
def save_prefs(body: NotificationPrefs, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_notification_prefs(
        user_id=user["id"],
        email_digest_enabled=int(body.email_digest_enabled),
        digest_cadence=body.digest_cadence,
        digest_day=body.digest_day,
        slack_enabled=int(body.slack_enabled),
        webhook_enabled=int(body.webhook_enabled),
        updated_at=now,
    )
    return {"ok": True}
