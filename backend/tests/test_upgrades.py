"""Tests for the upgrade layer: conformal, scenario, alerts, categories, fx, cache."""
import math

from app import cache, fx
from app.alerts import evaluate
from app.analytics.categories import analyze_categories
from app.data.synthetic import generate_ledger
from app.forecasting.pipeline import _conformal_level
from app.scenario import apply_scenario
from app.schemas import (
    Direction,
    ForecastPoint,
    ForecastResponse,
    Narrative,
    ScenarioInput,
    SeriesForecast,
    Thresholds,
)
from app.service import build_base_forecast


def test_conformal_level_widens_tails_not_median():
    n = 20
    assert _conformal_level(0.5, n) == 0.5  # median untouched
    assert _conformal_level(0.9, n) > 0.9  # upper tail pushed out
    assert _conformal_level(0.1, n) < 0.1  # lower tail pushed out
    # Degenerate small-n falls back to the nominal level.
    assert _conformal_level(0.9, 1) == 0.9


def test_conformal_levels_stay_in_unit_interval():
    for n in (2, 5, 20, 100):
        for q in (0.1, 0.5, 0.9):
            lvl = _conformal_level(q, n)
            assert 0.0 <= lvl <= 1.0


def _tiny_forecast() -> ForecastResponse:
    def series(name, unit, base):
        return SeriesForecast(
            name=name,
            label=name,
            unit=unit,
            model="naive",
            candidates={"naive": 1.0},
            metrics={"mase": 1.0, "pinball": 1.0, "coverage_80": 0.8, "n_origins": 5},
            history=[],
            forecast=[
                ForecastPoint(period="2026-07-05", p10=base - 10, p50=base, p90=base + 10),
                ForecastPoint(period="2026-07-12", p10=base - 10, p50=base, p90=base + 10),
            ],
        )

    return ForecastResponse(
        generated_at="2026-07-03T00:00:00",
        as_of="2026-06-28",
        horizon_weeks=2,
        currency="USD",
        opening_balance=1000.0,
        runway_weeks=None,
        projected_balance_p50=1000.0,
        series=[
            series("net_cash_flow", "USD", 100),
            series("inflow", "USD", 500),
            series("outflow", "USD", 400),
            series("mrr", "USD/mo", 8000),
        ],
        narrative=Narrative(
            text="test", source="template", model=None, grounded=True, used_values={}
        ),
    )


def test_scenario_growth_increases_projected_balance():
    base = _tiny_forecast()
    grow = apply_scenario(base, ScenarioInput(label="grow", revenue_growth_pct=10.0))
    assert grow.projected_balance_p50 > base.opening_balance
    assert grow.delta_net_total > 0


def test_scenario_one_off_inflow_adds_cash():
    base = _tiny_forecast()
    s = apply_scenario(
        base,
        ScenarioInput(one_off_amount=1000, one_off_direction=Direction.inflow, one_off_week=1),
    )
    plain = apply_scenario(base, ScenarioInput())
    assert s.projected_balance_p50 == plain.projected_balance_p50 + 1000


def test_alerts_runway_and_threshold():
    r = _tiny_forecast()
    r.projected_balance_p50 = 100.0
    alerts = evaluate(r, Thresholds(min_balance=500.0))
    codes = {a.code for a in alerts}
    assert "balance_floor" in codes


def test_alerts_ok_when_within_limits():
    r = _tiny_forecast()
    r.projected_balance_p50 = 5000.0
    alerts = evaluate(r, Thresholds(min_balance=1000.0))
    assert any(a.code == "ok" for a in alerts)


def test_category_decomposition_sums_are_signed():
    ledger = generate_ledger(weeks=52, seed=3)
    cats, drivers = analyze_categories(ledger, inflow_p50_total=100000, outflow_p50_total=80000)
    assert cats and drivers
    # Inflows positive, outflows negative in the signed representation.
    for c in cats:
        if c.direction == Direction.inflow:
            assert c.hist_total >= 0
        else:
            assert c.hist_total <= 0


def test_fx_convert_roundtrip():
    usd = 1000.0
    inr = fx.convert(usd, "USD", "INR")
    assert inr > usd  # INR rate > 1
    back = fx.convert(inr, "INR", "USD")
    assert math.isclose(back, usd, rel_tol=1e-9)


def test_cache_returns_cached_flag_on_second_call():
    cache.clear()
    ledger = generate_ledger(weeks=40, seed=11)
    calls = {"n": 0}

    def build():
        calls["n"] += 1
        return build_base_forecast(ledger, horizon=13)

    _, c1 = cache.get_or_build("k", build)
    _, c2 = cache.get_or_build("k", build)
    assert c1 is False and c2 is True
    assert calls["n"] == 1
