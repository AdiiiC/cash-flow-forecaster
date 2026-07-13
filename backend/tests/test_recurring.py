"""Tests for recurring scheduled items: expansion, overlay, and the API."""
from __future__ import annotations

import uuid
from datetime import date

from fastapi.testclient import TestClient

from app import recurring as recurring_mod
from app.main import app
from app.schemas import (
    BacktestMetrics,
    Cadence,
    Direction,
    ForecastPoint,
    ForecastResponse,
    Narrative,
    RecurringItem,
    SeriesForecast,
)

client = TestClient(app)


def _auth_headers() -> dict:
    email = f"rec-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---- occurrence expansion -----------------------------------------------------


def test_weekly_occurrences_within_window():
    occ = recurring_mod.occurrences(
        anchor=date(2024, 1, 1),
        cadence=Cadence.weekly,
        start=date(2024, 1, 1),
        end=date(2024, 1, 31),
    )
    assert occ == [
        date(2024, 1, 1),
        date(2024, 1, 8),
        date(2024, 1, 15),
        date(2024, 1, 22),
        date(2024, 1, 29),
    ]


def test_monthly_occurrences_fast_forward_from_past_anchor():
    occ = recurring_mod.occurrences(
        anchor=date(2023, 1, 15),  # well before the window
        cadence=Cadence.monthly,
        start=date(2024, 3, 1),
        end=date(2024, 5, 31),
    )
    assert occ == [date(2024, 3, 15), date(2024, 4, 15), date(2024, 5, 15)]


def test_month_end_clamps():
    occ = recurring_mod.occurrences(
        anchor=date(2024, 1, 31),
        cadence=Cadence.monthly,
        start=date(2024, 1, 1),
        end=date(2024, 4, 30),
    )
    # Feb clamps to 29 (2024 is a leap year), then back to 31 where months allow.
    assert occ == [date(2024, 1, 31), date(2024, 2, 29), date(2024, 3, 31), date(2024, 4, 30)]


# ---- overlay math -------------------------------------------------------------


def _series(name: str, periods: list[date], value: float) -> SeriesForecast:
    return SeriesForecast(
        name=name,
        label=name,
        unit="USD",
        model="naive",
        candidates={"naive": 1.0},
        metrics=BacktestMetrics(mase=1.0, pinball=1.0, coverage_85=0.85, n_origins=3),
        history=[],
        forecast=[ForecastPoint(period=p, p10=value, p50=value, p90=value) for p in periods],
    )


def _response(periods: list[date]) -> ForecastResponse:
    return ForecastResponse(
        generated_at="2024-01-01T00:00:00",
        as_of=date(2024, 1, 1),
        horizon_weeks=len(periods),
        currency="USD",
        opening_balance=1000.0,
        runway_weeks=None,
        projected_balance_p50=1000.0,
        series=[
            _series("net_cash_flow", periods, 0.0),
            _series("inflow", periods, 0.0),
            _series("outflow", periods, 0.0),
        ],
        narrative=Narrative(text="", source="template", grounded=True, used_values={}),
    )


def test_apply_recurring_shifts_balance_and_runway():
    periods = [date(2024, 1, 7), date(2024, 1, 14), date(2024, 1, 21), date(2024, 1, 28)]
    resp = _response(periods)
    item = RecurringItem(
        id="x",
        name="Payroll",
        amount=600.0,
        direction=Direction.outflow,
        cadence=Cadence.weekly,
        anchor_date=date(2024, 1, 7),
        category="Salaries",
        active=True,
        created_at="2024-01-01T00:00:00",
    )
    recurring_mod.apply_recurring(resp, [item])

    net = next(s for s in resp.series if s.name == "net_cash_flow")
    assert all(p.p50 == -600.0 for p in net.forecast)
    # Balance: 1000 -600 -600 -600 -600 -> goes negative in week 2.
    assert resp.runway_weeks == 2.0
    assert resp.projected_balance_p50 == -1400.0
    assert resp.recurring is not None
    assert resp.recurring.count == 1
    assert resp.recurring.outflow_total == 2400.0
    assert resp.recurring.net_total == -2400.0


def test_inactive_items_are_ignored():
    periods = [date(2024, 1, 7), date(2024, 1, 14)]
    resp = _response(periods)
    item = RecurringItem(
        id="x",
        name="Old",
        amount=500.0,
        direction=Direction.inflow,
        cadence=Cadence.weekly,
        anchor_date=date(2024, 1, 7),
        category=None,
        active=False,
        created_at="2024-01-01T00:00:00",
    )
    recurring_mod.apply_recurring(resp, [item])
    assert resp.recurring.count == 0
    assert resp.projected_balance_p50 == 1000.0


# ---- API ----------------------------------------------------------------------


def test_recurring_crud_flow():
    headers = _auth_headers()

    assert client.get("/api/recurring", headers=headers).json() == []

    payload = {
        "name": "Office rent",
        "amount": 2500,
        "direction": "outflow",
        "cadence": "monthly",
        "anchor_date": "2024-06-01",
        "category": "Rent",
    }
    r = client.post("/api/recurring", json=payload, headers=headers)
    assert r.status_code == 201
    item = r.json()
    assert item["name"] == "Office rent"
    assert item["active"] is True

    listed = client.get("/api/recurring", headers=headers).json()
    assert len(listed) == 1

    r = client.delete(f"/api/recurring/{item['id']}", headers=headers)
    assert r.status_code == 200
    assert client.get("/api/recurring", headers=headers).json() == []


def test_recurring_requires_auth():
    assert client.get("/api/recurring").status_code in (401, 403)


def test_recurring_blank_name_rejected():
    headers = _auth_headers()
    payload = {
        "name": "   ",
        "amount": 100,
        "direction": "inflow",
        "cadence": "weekly",
        "anchor_date": "2024-06-01",
    }
    assert client.post("/api/recurring", json=payload, headers=headers).status_code == 422


def test_recurring_is_scoped_per_user():
    a = _auth_headers()
    b = _auth_headers()
    payload = {
        "name": "A's payroll",
        "amount": 1000,
        "direction": "outflow",
        "cadence": "monthly",
        "anchor_date": "2024-06-01",
    }
    created = client.post("/api/recurring", json=payload, headers=a).json()
    # B cannot see or delete A's item.
    assert client.get("/api/recurring", headers=b).json() == []
    assert client.delete(f"/api/recurring/{created['id']}", headers=b).status_code == 404
