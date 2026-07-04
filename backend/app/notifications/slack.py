"""Slack alerting via an Incoming Webhook.

Fire-and-forget: posting must never break a forecast, so every failure is
swallowed with a log line. Notifications are opt-in — with no
``SLACK_WEBHOOK_URL`` configured every function here is a no-op.

De-duplication: the same set of alerts (same currency + codes + rounded
values) is only posted once per ``_DEDUP_TTL`` seconds so repeated forecasts of
an unchanged situation don't spam the channel.
"""
from __future__ import annotations

import json
import logging
import threading
import time
import urllib.request
from typing import Iterable

from app.config import get_settings
from app.schemas import Alert, ForecastResponse

logger = logging.getLogger(__name__)

# Only these levels are worth a push notification.
_NOTIFY_LEVELS = {"critical", "warning"}
_DEDUP_TTL = 3600.0  # seconds
_HTTP_TIMEOUT = 5.0  # seconds

_lock = threading.Lock()
_recent: dict[str, float] = {}


def _signature(currency: str, alerts: Iterable[Alert]) -> str:
    """Stable key for a set of alerts so identical situations de-duplicate."""
    parts = sorted(
        f"{a.code}:{a.level}:{'' if a.value is None else round(a.value, 1)}" for a in alerts
    )
    return currency + "|" + ";".join(parts)


def _should_send(signature: str) -> bool:
    """True if this signature hasn't been sent within the TTL. Records the send."""
    now = time.monotonic()
    with _lock:
        # Opportunistically drop stale entries so the dict can't grow unbounded.
        for key in [k for k, ts in _recent.items() if now - ts > _DEDUP_TTL]:
            _recent.pop(key, None)
        last = _recent.get(signature)
        if last is not None and now - last <= _DEDUP_TTL:
            return False
        _recent[signature] = now
    return True


def _emoji(level: str) -> str:
    return {"critical": ":rotating_light:", "warning": ":warning:"}.get(level, ":information_source:")


def _build_payload(response: ForecastResponse, alerts: list[Alert], source: str) -> dict:
    lines = [f"{_emoji(a.level)} *{a.level.upper()}* — {a.message}" for a in alerts]
    header = f"*Cash-Flow alert* · {source} · {response.currency}"
    context = (
        f"Projected balance {response.projected_balance_p50:,.0f} {response.currency} "
        f"· horizon {response.horizon_weeks}w"
    )
    return {
        "text": f"Cash-Flow alert: {len(alerts)} issue(s) on the {source} forecast",
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn", "text": header}},
            {"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(lines)}},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": context}]},
        ],
    }


def _post(url: str, payload: dict) -> None:
    """POST a JSON payload to the webhook. Raises on transport/HTTP error."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:  # noqa: S310 - fixed https webhook
        if resp.status >= 300:
            raise RuntimeError(f"Slack webhook returned HTTP {resp.status}")


def notify_alerts(response: ForecastResponse, source: str) -> bool:
    """Post the forecast's critical/warning alerts to Slack if configured.

    Returns True if a message was sent, False otherwise (disabled, no alerts,
    de-duplicated, or a swallowed error).
    """
    webhook = get_settings().slack_webhook_url.strip()
    if not webhook:
        return False

    alerts = [a for a in response.alerts if a.level in _NOTIFY_LEVELS]
    if not alerts:
        return False

    if not _should_send(_signature(response.currency, alerts)):
        return False

    try:
        _post(webhook, _build_payload(response, alerts, source))
        return True
    except Exception as exc:  # noqa: BLE001 - notifications must never break a forecast
        logger.warning("Slack notification failed: %s", exc, exc_info=True)
        return False
