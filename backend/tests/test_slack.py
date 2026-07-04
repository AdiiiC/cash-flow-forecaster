"""Slack alert notifications (HTTP call mocked)."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.notifications import slack
from app.schemas import Alert, ForecastResponse


def _response(alerts: list[Alert]) -> ForecastResponse:
    return ForecastResponse.model_validate(
        {
            "generated_at": "2024-01-01T00:00:00",
            "as_of": "2024-01-01",
            "horizon_weeks": 13,
            "currency": "USD",
            "opening_balance": 1000.0,
            "runway_weeks": 4.0,
            "projected_balance_p50": -500.0,
            "series": [],
            "narrative": {"text": "x", "source": "template", "grounded": True, "used_values": {}},
            "alerts": [a.model_dump() for a in alerts],
        }
    )


@pytest.fixture(autouse=True)
def _reset_dedup():
    slack._recent.clear()
    yield
    slack._recent.clear()


def _use_webhook(monkeypatch, url: str) -> list[dict]:
    sent: list[dict] = []
    monkeypatch.setattr(slack, "get_settings", lambda: SimpleNamespace(slack_webhook_url=url))
    monkeypatch.setattr(slack, "_post", lambda u, payload: sent.append(payload))
    return sent


def test_no_webhook_is_noop(monkeypatch):
    sent = _use_webhook(monkeypatch, "")
    r = _response([Alert(level="critical", code="runway", message="cash out soon", value=4.0)])
    assert slack.notify_alerts(r, "demo") is False
    assert sent == []


def test_posts_then_dedups(monkeypatch):
    sent = _use_webhook(monkeypatch, "https://hooks.slack.com/services/x/y/z")
    r = _response([Alert(level="critical", code="runway", message="cash out soon", value=4.0)])
    # First send goes out.
    assert slack.notify_alerts(r, "demo") is True
    # An identical alert set within the TTL is suppressed.
    assert slack.notify_alerts(r, "demo") is False
    assert len(sent) == 1
    assert sent[0]["blocks"]


def test_only_critical_and_warning_notify(monkeypatch):
    sent = _use_webhook(monkeypatch, "https://hooks.slack.com/services/x/y/z")
    r = _response([Alert(level="info", code="fyi", message="just so you know")])
    assert slack.notify_alerts(r, "demo") is False
    assert sent == []


def test_post_failure_is_swallowed(monkeypatch):
    monkeypatch.setattr(
        slack, "get_settings", lambda: SimpleNamespace(slack_webhook_url="https://hooks.slack.com/x")
    )

    def _boom(url, payload):
        raise RuntimeError("network down")

    monkeypatch.setattr(slack, "_post", _boom)
    r = _response([Alert(level="warning", code="balance_floor", message="low", value=1.0)])
    # Must not raise; returns False on swallowed error.
    assert slack.notify_alerts(r, "demo") is False
