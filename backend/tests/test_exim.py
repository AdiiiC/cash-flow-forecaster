"""Tests for ExIm (export/import) forex-aware invoices."""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.fx_forecast import FxPrediction, predict
from app.main import app

client = TestClient(app)


def _auth_headers() -> dict:
    email = f"exim-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _fake_prediction(fcy: str = "USD", base: str = "INR", days: int = 30) -> FxPrediction:
    return FxPrediction(
        pair=f"{fcy}/{base}",
        horizon_days=days,
        rate_p50=84.0,
        rate_p10=82.5,
        rate_p90=85.5,
        spot_today=83.5,
        model="test_mock",
        as_of=date.today(),
    )


def _mock_predict(fcy, base, days):
    return _fake_prediction(fcy, base, days)


# ── fx_forecast unit tests ──────────────────────────────────────────────────

def test_fx_predict_short_horizon():
    """N <= 7 returns spot_slippage model with narrow band."""
    from app.fx_history import RatePoint

    fake_history = [RatePoint(date.today() - timedelta(days=i), 83.5) for i in range(6, -1, -1)]
    with patch("app.fx_history.fetch_history", return_value=fake_history):
        pred = predict("USD", "INR", 5)
    assert pred.model == "spot_slippage"
    assert pred.rate_p10 < pred.rate_p50 < pred.rate_p90
    assert pred.spot_today == pytest.approx(83.5, abs=0.01)


def test_fx_predict_long_horizon():
    """N > 7 uses the ensemble model."""
    from app.fx_history import RatePoint

    # 30 days of slightly upward-trending rates
    rates = [83.0 + i * 0.05 for i in range(30)]
    fake_history = [
        RatePoint(date.today() - timedelta(days=29 - i), r) for i, r in enumerate(rates)
    ]
    with patch("app.fx_history.fetch_history", return_value=fake_history):
        pred = predict("USD", "INR", 30)
    assert pred.model == "drift_damped_holt_ensemble"
    assert pred.rate_p10 < pred.rate_p50 < pred.rate_p90
    # Interval widens with horizon
    assert pred.rate_p90 - pred.rate_p10 > 0.5


def test_fx_predict_no_history_raises():
    with patch("app.fx_history.fetch_history", return_value=[]):
        with pytest.raises(ValueError, match="No rate history"):
            predict("USD", "INR", 30)


# ── API CRUD tests ───────────────────────────────────────────────────────────

def test_create_and_list_exim():
    headers = _auth_headers()
    payload = {
        "kind": "receivable",
        "counterparty": "US Buyer Corp",
        "fcy_code": "USD",
        "fcy_amount": 50000,
        "base_currency": "INR",
        "payment_terms_days": 45,
        "issue_date": date.today().isoformat(),
    }
    with patch("app.routers.exim.fx_predict", side_effect=_mock_predict):
        r = client.post("/api/exim", json=payload, headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert data["counterparty"] == "US Buyer Corp"
    assert data["fcy_code"] == "USD"
    assert data["predicted_rate_p50"] == pytest.approx(84.0)
    assert data["base_amount_p50"] == pytest.approx(50000 * 84.0, abs=1.0)
    assert data["due_date"] == (date.today() + timedelta(days=45)).isoformat()

    r2 = client.get("/api/exim", headers=headers)
    assert r2.status_code == 200
    ids = [x["id"] for x in r2.json()]
    assert data["id"] in ids


def test_update_exim_status():
    headers = _auth_headers()
    payload = {
        "kind": "payable",
        "counterparty": "DE Supplier GmbH",
        "fcy_code": "EUR",
        "fcy_amount": 10000,
        "base_currency": "INR",
        "payment_terms_days": 30,
        "issue_date": date.today().isoformat(),
    }
    with patch("app.routers.exim.fx_predict", side_effect=_mock_predict):
        r = client.post("/api/exim", json=payload, headers=headers)
    exim_id = r.json()["id"]

    r2 = client.patch(
        f"/api/exim/{exim_id}/status", json={"status": "paid"}, headers=headers
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "paid"


def test_delete_exim():
    headers = _auth_headers()
    payload = {
        "kind": "receivable",
        "counterparty": "SG Partner Ltd",
        "fcy_code": "SGD",
        "fcy_amount": 20000,
        "base_currency": "INR",
        "payment_terms_days": 60,
        "issue_date": date.today().isoformat(),
    }
    with patch("app.routers.exim.fx_predict", side_effect=_mock_predict):
        r = client.post("/api/exim", json=payload, headers=headers)
    exim_id = r.json()["id"]

    r2 = client.delete(f"/api/exim/{exim_id}", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["deleted"] == exim_id

    r3 = client.get("/api/exim", headers=headers)
    ids = [x["id"] for x in r3.json()]
    assert exim_id not in ids


def test_exim_requires_auth():
    r = client.get("/api/exim")
    assert r.status_code == 401


def test_exim_static_fallback(monkeypatch):
    """If frankfurter.app is unreachable, the static fallback is used."""
    headers = _auth_headers()

    def _raise(fcy, base, days):
        raise ConnectionError("network down")

    monkeypatch.setattr("app.routers.exim.fx_predict", _raise)
    payload = {
        "kind": "receivable",
        "counterparty": "AE Partner LLC",
        "fcy_code": "AED",
        "fcy_amount": 100000,
        "base_currency": "INR",
        "payment_terms_days": 30,
        "issue_date": date.today().isoformat(),
    }
    r = client.post("/api/exim", json=payload, headers=headers)
    assert r.status_code == 201
    assert r.json()["rate_model"] == "static_fallback"
