"""Unit tests for the deterministic runway insight / recommendation builder."""
from __future__ import annotations

from datetime import date

from app.insights import build_insight
from app.schemas import ForecastPoint


def _net(weekly: float, weeks: int = 13) -> list[ForecastPoint]:
    return [
        ForecastPoint(period=f"2024-01-{i:02d}", p10=weekly, p50=weekly, p90=weekly)
        for i in range(1, weeks + 1)
    ]


def test_insolvent_reports_danger_date_and_cut_recommendation():
    insight = build_insight(
        as_of=date(2024, 1, 1),
        opening_balance=10_000.0,
        net_forecast=_net(-2_000.0),
        runway_weeks=5.0,
        horizon=13,
        currency="USD",
    )
    assert insight.solvent is False
    assert insight.runway_weeks == 5.0
    assert insight.runway_months == round(5.0 / 4.33, 1)
    assert insight.runway_date == date(2024, 2, 5)  # +5 weeks
    kinds = {r.kind for r in insight.recommendations}
    assert "cut" in kinds  # burning faster than the healthy pace -> coach a cut
    assert any("runs out" in r.message for r in insight.recommendations)


def test_solvent_reports_affordability_headroom():
    insight = build_insight(
        as_of=date(2024, 1, 1),
        opening_balance=50_000.0,
        net_forecast=_net(1_000.0),
        runway_weeks=None,
        horizon=13,
        currency="USD",
    )
    assert insight.solvent is True
    assert insight.runway_date is None
    assert insight.runway_months is None
    assert any(r.kind == "afford" for r in insight.recommendations)


def test_currency_symbol_used_in_messages():
    insight = build_insight(
        as_of=date(2024, 1, 1),
        opening_balance=50_000.0,
        net_forecast=_net(1_000.0),
        runway_weeks=None,
        horizon=13,
        currency="INR",
    )
    afford = next(r for r in insight.recommendations if r.kind == "afford")
    assert "₹" in afford.message
