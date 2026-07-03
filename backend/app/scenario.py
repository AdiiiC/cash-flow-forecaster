"""Deterministic what-if overlay on a baseline forecast.

Important: this does NOT re-run the backtest. It applies transparent, labeled
transformations to the *point* forecast (and shifts the conformal band with it),
so planning is instant. The UI marks scenario output as an overlay, never as a
re-estimated model — that keeps the anti-slop contract intact.
"""
from __future__ import annotations

from copy import deepcopy

from app.schemas import (
    Direction,
    ForecastPoint,
    ForecastResponse,
    ScenarioInput,
    ScenarioResult,
    SeriesForecast,
)


def _growth_factor(pct: float, week: int) -> float:
    return (1.0 + pct / 100.0) ** week


def _adjust_inflow(series: SeriesForecast, scenario: ScenarioInput) -> SeriesForecast:
    s = deepcopy(series)
    s.forecast = [
        ForecastPoint(
            period=p.period,
            p10=round(p.p10 * _growth_factor(scenario.revenue_growth_pct, i + 1), 2),
            p50=round(p.p50 * _growth_factor(scenario.revenue_growth_pct, i + 1), 2),
            p90=round(p.p90 * _growth_factor(scenario.revenue_growth_pct, i + 1), 2),
        )
        for i, p in enumerate(series.forecast)
    ]
    return s


def _adjust_outflow(series: SeriesForecast, scenario: ScenarioInput) -> SeriesForecast:
    s = deepcopy(series)
    m = scenario.cost_multiplier
    s.forecast = [
        ForecastPoint(period=p.period, p10=round(p.p10 * m, 2), p50=round(p.p50 * m, 2), p90=round(p.p90 * m, 2))
        for p in series.forecast
    ]
    return s


def _recompute_net(inflow: SeriesForecast, outflow: SeriesForecast, scenario: ScenarioInput, template: SeriesForecast) -> SeriesForecast:
    s = deepcopy(template)
    points = []
    for i, (fi, fo) in enumerate(zip(inflow.forecast, outflow.forecast)):
        one_off = 0.0
        if i + 1 == scenario.one_off_week and scenario.one_off_amount:
            sign = 1.0 if scenario.one_off_direction == Direction.inflow else -1.0
            one_off = sign * scenario.one_off_amount
        points.append(
            ForecastPoint(
                period=fi.period,
                p10=round(fi.p10 - fo.p90 + one_off, 2),
                p50=round(fi.p50 - fo.p50 + one_off, 2),
                p90=round(fi.p90 - fo.p10 + one_off, 2),
            )
        )
    s.forecast = points
    return s


def apply_scenario(baseline: ForecastResponse, scenario: ScenarioInput) -> ScenarioResult:
    by_name = {s.name: s for s in baseline.series}
    inflow = _adjust_inflow(by_name["inflow"], scenario)
    outflow = _adjust_outflow(by_name["outflow"], scenario)
    mrr = _adjust_inflow(by_name["mrr"], scenario)  # MRR grows with revenue
    net = _recompute_net(inflow, outflow, scenario, by_name["net_cash_flow"])

    adjusted = [net, inflow, outflow, mrr]

    balance = baseline.opening_balance
    runway_weeks: float | None = None
    for i, pt in enumerate(net.forecast, start=1):
        balance += pt.p50
        if balance < 0 and runway_weeks is None:
            runway_weeks = float(i)

    base_net_total = sum(p.p50 for p in by_name["net_cash_flow"].forecast)
    scen_net_total = sum(p.p50 for p in net.forecast)

    return ScenarioResult(
        label=scenario.label,
        series=adjusted,
        projected_balance_p50=round(balance, 2),
        runway_weeks=runway_weeks,
        delta_projected_balance=round(balance - baseline.projected_balance_p50, 2),
        delta_net_total=round(scen_net_total - base_net_total, 2),
    )
