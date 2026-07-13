"""
Outbound webhook delivery with HMAC-SHA256 request signing and 3× retry.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

log = logging.getLogger(__name__)
_RETRY_DELAYS = [0, 30, 120]   # seconds between attempts (0 = immediate first attempt)


def _sign(secret: str, payload: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def _attempt(url: str, payload: bytes, headers: dict) -> tuple[int | None, str | None]:
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, str(e)
    except Exception as exc:
        return None, str(exc)


def fire_webhook(webhook_id: str, url: str, secret: str,
                 event: str, payload: dict) -> None:
    """
    Fire an outbound webhook in a background thread with 3 attempts.
    Logs delivery outcomes to webhook_deliveries table.
    """
    def _run():
        from app import store as _store
        body = json.dumps({"event": event, **payload}).encode()
        signature = _sign(secret, body)
        headers = {
            "Content-Type":  "application/json",
            "X-ClearCash-Signature": signature,
            "X-ClearCash-Event":     event,
            "User-Agent":    "ClearCash-Webhook/1.0",
        }
        for attempt, delay in enumerate(_RETRY_DELAYS, start=1):
            if delay:
                time.sleep(delay)
            status_code, error = _attempt(url, body, headers)
            success = status_code is not None and 200 <= status_code < 300
            delivery_id = uuid.uuid4().hex[:12]
            next_retry = None
            if not success and attempt < len(_RETRY_DELAYS):
                next_retry = datetime.now(timezone.utc).isoformat()
            try:
                _store.save_webhook_delivery(
                    delivery_id=delivery_id,
                    webhook_id=webhook_id,
                    event=event,
                    payload_preview=json.dumps(payload)[:500],
                    status_code=status_code,
                    error=error,
                    next_retry_at=next_retry,
                    attempt_count=attempt,
                    success=success,
                )
            except Exception as exc:
                log.warning("Failed to log webhook delivery: %s", exc)
            if success:
                break
            log.warning("Webhook attempt %d/%d to %s failed (status=%s): %s",
                        attempt, len(_RETRY_DELAYS), url, status_code, error)

    threading.Thread(target=_run, daemon=True).start()


def dispatch_event(event: str, payload: dict, user_id: str | None = None) -> None:
    """
    Load all active webhooks for this user/org that subscribe to `event`
    and fire them.
    """
    from app import store as _store
    try:
        hooks = _store.list_webhooks_for_event(event, user_id)
        for hook in hooks:
            fire_webhook(
                webhook_id=hook["id"],
                url=hook["url"],
                secret=hook["secret"],
                event=event,
                payload=payload,
            )
    except Exception as exc:
        log.warning("dispatch_event error (%s): %s", event, exc)
