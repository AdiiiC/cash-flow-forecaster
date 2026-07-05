"""Tests for invoices/bills (AR/AP): overlay math, encryption at rest, API."""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app import receivables as receivables_mod
from app import store
from app.main import app
from app.schemas import (
    BacktestMetrics,
    ForecastPoint,
    ForecastResponse,
    Invoice,
    InvoiceKind,
    InvoiceStatus,
    Narrative,
    SeriesForecast,
)

client = TestClient(app)


def _auth_headers() -> dict:
    email = f"inv-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _series(name: str, periods: list[date]) -> SeriesForecast:
    return SeriesForecast(
        name=name,
        label=name,
        unit="USD",
        model="naive",
        candidates={"naive": 1.0},
        metrics=BacktestMetrics(mase=1.0, pinball=1.0, coverage_80=0.8, n_origins=3),
        history=[],
        forecast=[ForecastPoint(period=p, p10=0.0, p50=0.0, p90=0.0) for p in periods],
    )


def _response(periods: list[date], as_of: date) -> ForecastResponse:
    return ForecastResponse(
        generated_at="2024-01-01T00:00:00",
        as_of=as_of,
        horizon_weeks=len(periods),
        currency="USD",
        opening_balance=1000.0,
        runway_weeks=None,
        projected_balance_p50=1000.0,
        series=[
            _series("net_cash_flow", periods),
            _series("inflow", periods),
            _series("outflow", periods),
        ],
        narrative=Narrative(text="", source="template", grounded=True, used_values={}),
    )


def _invoice(kind: InvoiceKind, amount: float, due: date, status=InvoiceStatus.open) -> Invoice:
    return Invoice(
        id=uuid.uuid4().hex[:8],
        kind=kind,
        counterparty="Acme",
        amount=amount,
        issue_date=due - timedelta(days=30),
        due_date=due,
        category=None,
        status=status,
        created_at="2024-01-01T00:00:00",
    )


# ---- overlay ------------------------------------------------------------------


def test_receivable_adds_inflow_on_due_week():
    as_of = date(2024, 1, 1)
    periods = [date(2024, 1, 7), date(2024, 1, 14), date(2024, 1, 21)]
    resp = _response(periods, as_of)
    inv = _invoice(InvoiceKind.receivable, 500.0, due=date(2024, 1, 12))
    receivables_mod.apply_receivables(resp, [inv])

    net = next(s for s in resp.series if s.name == "net_cash_flow")
    assert net.forecast[1].p50 == 500.0  # lands in the week ending Jan 14
    assert resp.projected_balance_p50 == 1500.0
    assert resp.receivables.expected_inflow == 500.0
    assert resp.receivables.count == 1


def test_payable_reduces_balance_and_can_break_runway():
    as_of = date(2024, 1, 1)
    periods = [date(2024, 1, 7), date(2024, 1, 14)]
    resp = _response(periods, as_of)
    inv = _invoice(InvoiceKind.payable, 1500.0, due=date(2024, 1, 6))
    receivables_mod.apply_receivables(resp, [inv])
    assert resp.runway_weeks == 1.0  # 1000 - 1500 < 0 in week 1
    assert resp.receivables.expected_outflow == 1500.0


def test_paid_invoices_are_ignored():
    as_of = date(2024, 1, 1)
    periods = [date(2024, 1, 7)]
    resp = _response(periods, as_of)
    inv = _invoice(InvoiceKind.receivable, 999.0, due=date(2024, 1, 7), status=InvoiceStatus.paid)
    receivables_mod.apply_receivables(resp, [inv])
    assert resp.receivables.count == 0
    assert resp.projected_balance_p50 == 1000.0


def test_past_due_open_item_buckets_into_first_week():
    as_of = date(2024, 1, 1)
    periods = [date(2024, 1, 7), date(2024, 1, 14)]
    resp = _response(periods, as_of)
    inv = _invoice(InvoiceKind.receivable, 300.0, due=date(2023, 12, 20))  # past due
    receivables_mod.apply_receivables(resp, [inv])
    net = next(s for s in resp.series if s.name == "net_cash_flow")
    assert net.forecast[0].p50 == 300.0
    assert resp.receivables.overdue_count == 1


# ---- encryption at rest -------------------------------------------------------


def test_counterparty_encrypted_in_db(monkeypatch):
    from cryptography.fernet import Fernet
    import app.config as config
    import app.security.crypto as crypto

    monkeypatch.setenv("DATA_ENCRYPTION_KEY", Fernet.generate_key().decode())
    config.get_settings.cache_clear()
    crypto._fernet.cache_clear()

    headers = _auth_headers()
    payload = {
        "kind": "receivable",
        "counterparty": "SecretClient LLC",
        "amount": 1000,
        "issue_date": "2024-01-01",
        "due_date": "2024-02-01",
    }
    r = client.post("/api/invoices", json=payload, headers=headers)
    assert r.status_code == 201
    inv_id = r.json()["id"]
    # API round-trips plaintext.
    assert r.json()["counterparty"] == "SecretClient LLC"

    # But the raw DB cell is ciphertext.
    with store._engine().connect() as conn:
        from sqlalchemy import text

        raw = conn.execute(
            text("SELECT counterparty FROM invoices WHERE id = :id"), {"id": inv_id}
        ).scalar()
    assert raw is not None
    assert raw.startswith("enc:v1:")
    assert "SecretClient" not in raw

    config.get_settings.cache_clear()
    crypto._fernet.cache_clear()


# ---- API ----------------------------------------------------------------------


def test_invoice_crud_and_status_flow():
    headers = _auth_headers()
    assert client.get("/api/invoices", headers=headers).json() == []

    payload = {
        "kind": "payable",
        "counterparty": "Cloud Vendor",
        "amount": 250,
        "issue_date": "2024-05-01",
        "due_date": "2024-05-15",
        "category": "SaaS",
    }
    r = client.post("/api/invoices", json=payload, headers=headers)
    assert r.status_code == 201
    inv = r.json()
    assert inv["kind"] == "payable"
    assert inv["status"] == "open"

    r = client.patch(f"/api/invoices/{inv['id']}/status", json={"status": "paid"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "paid"

    r = client.delete(f"/api/invoices/{inv['id']}", headers=headers)
    assert r.status_code == 200
    assert client.get("/api/invoices", headers=headers).json() == []


def test_due_before_issue_rejected():
    headers = _auth_headers()
    payload = {
        "kind": "receivable",
        "counterparty": "X",
        "amount": 10,
        "issue_date": "2024-05-15",
        "due_date": "2024-05-01",
    }
    assert client.post("/api/invoices", json=payload, headers=headers).status_code == 422


def test_invoices_require_auth():
    assert client.get("/api/invoices").status_code in (401, 403)


def test_invoices_scoped_per_user():
    a = _auth_headers()
    b = _auth_headers()
    payload = {
        "kind": "receivable",
        "counterparty": "A Client",
        "amount": 500,
        "issue_date": "2024-05-01",
        "due_date": "2024-06-01",
    }
    created = client.post("/api/invoices", json=payload, headers=a).json()
    assert client.get("/api/invoices", headers=b).json() == []
    assert client.delete(f"/api/invoices/{created['id']}", headers=b).status_code == 404
