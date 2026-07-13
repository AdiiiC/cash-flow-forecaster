"""Outbound webhook configuration router.

Endpoints:
  GET    /api/webhooks-config             — list configured endpoints
  POST   /api/webhooks-config             — add webhook endpoint
  DELETE /api/webhooks-config/{id}        — remove webhook
  PATCH  /api/webhooks-config/{id}/toggle — enable/disable
  POST   /api/webhooks-config/{id}/test   — fire a test ping
  GET    /api/webhooks-config/{id}/deliveries — recent delivery log
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl

from app import store
from app.auth import get_current_user

router = APIRouter(prefix="/webhooks-config", tags=["webhooks"])

VALID_EVENTS = {
    "forecast.completed",
    "alert.critical",
    "alert.warning",
    "invoice.overdue",
    "runway.critical",
    "actuals.variance_exceeded",
    "budget.breach",
    "scheduled.forecast.completed",
}


class WebhookCreate(BaseModel):
    url: str
    events: list[str]

    def validate_events(self):
        bad = set(self.events) - VALID_EVENTS
        if bad:
            raise ValueError(f"Unknown event types: {bad}")


@router.get("")
def list_webhooks(user: dict = Depends(get_current_user)):
    hooks = store.list_webhooks_cfg(user["id"])
    # Mask the secret
    return [{**h, "secret": h["secret"][:8] + "…"} for h in hooks]


@router.post("", status_code=201)
def create_webhook(body: WebhookCreate, user: dict = Depends(get_current_user)):
    body.validate_events()
    import json
    row_id = uuid.uuid4().hex[:12]
    secret = secrets.token_hex(32)
    now = datetime.now(timezone.utc).isoformat()
    store.save_webhook_cfg(
        id=row_id, user_id=user["id"],
        url=str(body.url), events=json.dumps(body.events),
        secret=secret, created_at=now,
    )
    store.record_audit("webhook.create", user_id=user["id"], entity=row_id)
    return {"id": row_id, "secret": secret,
            "note": "Save this secret — it will not be shown again."}


@router.delete("/{hook_id}", status_code=204)
def delete_webhook(hook_id: str, user: dict = Depends(get_current_user)):
    store.delete_webhook_cfg(hook_id, user["id"])
    store.record_audit("webhook.delete", user_id=user["id"], entity=hook_id)


@router.patch("/{hook_id}/toggle")
def toggle_webhook(hook_id: str, user: dict = Depends(get_current_user)):
    hook = store.get_webhook_cfg(hook_id, user["id"])
    if not hook:
        raise HTTPException(404, "Webhook not found.")
    new_active = 0 if hook["active"] else 1
    store.update_webhook_active(hook_id, new_active)
    return {"active": bool(new_active)}


@router.post("/{hook_id}/test")
def test_webhook(hook_id: str, user: dict = Depends(get_current_user)):
    hook = store.get_webhook_cfg(hook_id, user["id"])
    if not hook:
        raise HTTPException(404, "Webhook not found.")
    from app.notifications.webhook_delivery import fire_webhook
    fire_webhook(
        webhook_id=hook_id,
        url=hook["url"],
        secret=hook["secret"],
        event="test.ping",
        payload={"message": "ClearCash test ping", "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    return {"message": "Test ping dispatched (check delivery log in a few seconds)."}


@router.get("/{hook_id}/deliveries")
def delivery_log(hook_id: str, user: dict = Depends(get_current_user)):
    hook = store.get_webhook_cfg(hook_id, user["id"])
    if not hook:
        raise HTTPException(404, "Webhook not found.")
    return store.list_webhook_deliveries(hook_id, limit=50)
