"""Orchestration: ledger -> weekly series -> forecasts -> analytics -> narrative.

The heavy base forecast (series + backtest + analytics + narrative) is built
once and cached; the cheap per-request layer (threshold alerts, scenario
overlay) is applied on top every call so those toggles feel instant.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Callable

from app import alerts as alerts_mod
from app import cache, store
from app import scenario as scenario_mod
from app.analytics.categories import analyze_categories
from app.config import get_settings
from app.data.aggregate import weekly_series
from app.forecasting.pipeline import run_series_forecast
from app.insights import build_insight
from app.llm.narrative import build_narrative
from app.notifications import slack
from app.schemas import (
    ForecastResponse,
    IntervalCalibration,
    Ledger,
    ScenarioInput,
    SeriesForecast,
    Thresholds,
)

logger = logging.getLogger("cashflow.service")

SERIES_LABELS = {
    "net_cash_flow": "Net cash flow",
    "inflow": "Cash inflows",
    "outflow": "Cash outflows",
    "mrr": "Monthly recurring revenue",
}

# Progress callback signature: (fraction 0..1, human-readable stage message).
ProgressFn = Callable[[float, str], None]

_ORDER = ("net_cash_flow", "inflow", "outflow", "mrr")


def base_cache_key(ledger: Ledger, horizon: int) -> str:
    """Key the expensive forecast on inputs that change the numbers."""
    settings = get_settings()
    return "|".join(
        str(x)
        for x in (
            round(ledger.opening_balance, 2),
            ledger.currency,
            horizon,
            settings.backtest_origins,
            len(ledger.entries),
            round(sum(e.amount for e in ledger.entries), 2),
            ledger.entries[0].date.isoformat(),
            ledger.entries[-1].date.isoformat(),
        )
    )


def build_base_forecast(
    ledger: Ledger,
    horizon: int | None = None,
    progress: ProgressFn | None = None,
) -> ForecastResponse:
    settings = get_settings()
    horizon = horizon or settings.horizon_weeks
    series_map = weekly_series(ledger)

    def _run(name: str) -> SeriesForecast:
        return run_series_forecast(
            series=series_map[name],
            name=name,
            label=SERIES_LABELS[name],
            horizon=horizon,
            n_origins=settings.backtest_origins,
            unit=ledger.currency if name != "mrr" else f"{ledger.currency}/mo",
        )

    # The four series are independent backtests; run them in parallel. The heavy
    # numeric work (numpy/sklearn) releases the GIL, so threads give a real ~4x
    # speedup without the overhead or pickling cost of processes.
    results: dict[str, SeriesForecast] = {}
    if progress:
        progress(0.1, "Backtesting cash-flow series")
    with ThreadPoolExecutor(max_workers=len(_ORDER)) as pool:
        futures = {pool.submit(_run, name): name for name in _ORDER}
        done = 0
        for future in as_completed(futures):
            name = futures[future]
            results[name] = future.result()
            done += 1
            if progress:
                progress(
                    0.1 + 0.7 * (done / len(_ORDER)),
                    f"Backtested {done}/{len(_ORDER)} series",
                )
    forecasts: list[SeriesForecast] = [results[name] for name in _ORDER]

    net = next(f for f in forecasts if f.name == "net_cash_flow")
    inflow = next(f for f in forecasts if f.name == "inflow")
    outflow = next(f for f in forecasts if f.name == "outflow")
    mrr = next(f for f in forecasts if f.name == "mrr")

    balance = ledger.opening_balance
    runway_weeks: float | None = None
    for i, pt in enumerate(net.forecast, start=1):
        balance += pt.p50
        if balance < 0 and runway_weeks is None:
            runway_weeks = float(i)
    projected_balance_p50 = balance

    inflow_total = round(sum(p.p50 for p in inflow.forecast), 2)
    outflow_total = round(sum(p.p50 for p in outflow.forecast), 2)

    if progress:
        progress(0.85, "Decomposing drivers")
    categories, drivers = analyze_categories(ledger, inflow_total, outflow_total)

    # Interval calibration: mean empirical P10-P90 coverage across series.
    per_series = {
        f.name: f.metrics.coverage_80
        for f in forecasts
        if f.metrics.coverage_80 == f.metrics.coverage_80  # exclude NaN
    }
    empirical = round(sum(per_series.values()) / len(per_series), 3) if per_series else float("nan")
    calibration = IntervalCalibration(
        target=0.8, empirical=empirical, conformal=True, per_series=per_series
    )

    as_of = ledger.entries[-1].date
    values = {
        "horizon_weeks": float(horizon),
        "opening_balance": round(ledger.opening_balance, 2),
        "projected_balance_p50": round(projected_balance_p50, 2),
        "net_p50_total": round(sum(p.p50 for p in net.forecast), 2),
        "inflow_p50_total": inflow_total,
        "outflow_p50_total": outflow_total,
        "mrr_latest": round(mrr.history[-1].value if mrr.history else 0.0, 2),
    }
    if runway_weeks is not None:
        values["runway_weeks"] = runway_weeks

    if progress:
        progress(0.92, "Writing CFO briefing")
    narrative = build_narrative(values, ledger.currency)

    insight = build_insight(
        as_of=as_of,
        opening_balance=ledger.opening_balance,
        net_forecast=net.forecast,
        runway_weeks=runway_weeks,
        horizon=horizon,
        currency=ledger.currency,
    )

    return ForecastResponse(
        generated_at=datetime.utcnow(),
        as_of=as_of,
        horizon_weeks=horizon,
        currency=ledger.currency,
        opening_balance=round(ledger.opening_balance, 2),
        runway_weeks=runway_weeks,
        projected_balance_p50=round(projected_balance_p50, 2),
        series=forecasts,
        narrative=narrative,
        categories=categories,
        drivers=drivers,
        calibration=calibration,
        insight=insight,
    )


def finalize(
    base: ForecastResponse,
    thresholds: Thresholds | None,
    scenario: ScenarioInput | None,
    cached: bool,
) -> ForecastResponse:
    """Apply the cheap per-request layer: cache flag, alerts, scenario overlay."""
    result = base.model_copy(deep=True)
    result.cached = cached
    result.alerts = alerts_mod.evaluate(result, thresholds)
    if scenario is not None:
        result.scenario = scenario_mod.apply_scenario(result, scenario)
    return result


def build_forecast(
    ledger: Ledger,
    horizon: int | None = None,
    *,
    source: str = "demo",
    label: str = "",
    thresholds: Thresholds | None = None,
    scenario: ScenarioInput | None = None,
    use_cache: bool = True,
    persist: bool = True,
    user_id: str | None = None,
    progress: ProgressFn | None = None,
) -> ForecastResponse:
    settings = get_settings()
    h = horizon or settings.horizon_weeks

    if use_cache:
        key = base_cache_key(ledger, h)
        base, cached = cache.get_or_build(key, lambda: build_base_forecast(ledger, h, progress))
    else:
        base, cached = build_base_forecast(ledger, h, progress), False

    result = finalize(base, thresholds, scenario, cached)

    if persist:
        run_label = label or f"{source} · {ledger.currency} · {h}w"
        try:
            store.save_run(result, source=source, label=run_label, user_id=user_id)
        except Exception as exc:  # noqa: BLE001 - persistence must never break a forecast
            logger.warning("Failed to persist forecast run: %s", exc, exc_info=True)

    # Fire-and-forget Slack alerts (no-op unless SLACK_WEBHOOK_URL is set).
    slack.notify_alerts(result, source)

    if progress:
        progress(1.0, "Done")
    return result
