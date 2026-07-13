"""Walk-forward forecasting pipeline with conformal prediction intervals.

Design principles (the anti-slop contract):
- No leakage: every backtest forecast is trained only on data strictly before
  the forecast origin (expanding window).
- Baselines first: all candidate models are scored by MASE; the winner must
  beat the naive baseline or it does not get picked.
- Honest uncertainty: prediction intervals come from empirical residual
  quantiles (split-conformal style), and coverage is measured on a disjoint
  slice of backtest origins to avoid self-congratulatory metrics.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.forecasting import baselines, metrics
from app.schemas import BacktestMetrics, ForecastPoint, HistoryPoint, SeriesForecast

QUANTILES = (0.075, 0.5, 0.925)  # 85% nominal interval (p7.5–p92.5)


def _conformal_level(q: float, n: int) -> float:
    """Finite-sample adjusted quantile level (split-conformal calibration).

    The naive empirical quantile of ``n`` residuals under-covers on small
    samples. The classic conformal fix inflates the tail using the
    ``ceil((n+1)(1-alpha))/n`` order statistic, which guarantees ~nominal
    marginal coverage. The median (q=0.5) is left untouched so the point
    forecast is not biased.
    """
    if n < 2 or q == 0.5:
        return q
    if q > 0.5:
        return min(1.0, math.ceil((n + 1) * q) / n)
    return max(0.0, 1.0 - math.ceil((n + 1) * (1.0 - q)) / n)


@dataclass
class _Record:
    origin: int
    step: int  # 1-based horizon step
    actual: float
    pred: float


def _walk_forward(y: np.ndarray, model, horizon: int, n_origins: int) -> list[_Record]:
    """Expanding-window backtest. Origins are the last ``n_origins`` feasible cuts."""
    records: list[_Record] = []
    # An origin t means: train on y[:t], evaluate against y[t:t+horizon].
    max_origin = y.size - 1
    min_origin = max(4, y.size - n_origins - horizon)
    for t in range(min_origin, max_origin):
        avail = min(horizon, y.size - t)
        if avail <= 0:
            continue
        preds = model(y[:t], horizon)[:avail]
        for step in range(avail):
            records.append(_Record(origin=t, step=step + 1, actual=y[t + step], pred=preds[step]))
    return records


def _residual_quantiles_by_step(
    records: list[_Record], horizon: int
) -> dict[int, dict[float, float]]:
    """Empirical quantiles of (actual - pred) residuals, grouped by horizon step."""
    by_step: dict[int, list[float]] = {s: [] for s in range(1, horizon + 1)}
    for r in records:
        by_step[r.step].append(r.actual - r.pred)
    pooled = [r.actual - r.pred for r in records] or [0.0]

    out: dict[int, dict[float, float]] = {}
    for step in range(1, horizon + 1):
        sample = by_step[step] if len(by_step[step]) >= 3 else pooled
        n = len(sample)
        out[step] = {q: float(np.quantile(sample, _conformal_level(q, n))) for q in QUANTILES}
    return out


def run_series_forecast(
    series: pd.Series,
    name: str,
    label: str,
    horizon: int,
    n_origins: int,
    unit: str = "USD",
) -> SeriesForecast:
    y = series.to_numpy(dtype=float)
    index = series.index

    # Degenerate / very short series: fall back to naive with a heuristic band.
    if y.size < 8:
        return _short_series_forecast(y, index, name, label, horizon, unit)

    models = baselines.default_models(season=1, n_obs=y.size)
    scale = metrics.naive_scale(y, season=1)

    # Score every candidate by out-of-sample MASE.
    candidate_mase: dict[str, float] = {}
    candidate_records: dict[str, list[_Record]] = {}
    for model_id, model in models.items():
        records = _walk_forward(y, model, horizon, n_origins)
        candidate_records[model_id] = records
        actual = np.array([r.actual for r in records])
        pred = np.array([r.pred for r in records])
        candidate_mase[model_id] = metrics.mase(actual, pred, scale)

    best_id = min(candidate_mase, key=candidate_mase.get)
    best_model = models[best_id]
    records = candidate_records[best_id]

    # Calibrate intervals on earlier origins, evaluate on later origins (disjoint).
    origins_sorted = sorted({r.origin for r in records})
    split = origins_sorted[len(origins_sorted) // 2] if len(origins_sorted) > 3 else None
    if split is not None:
        calib = [r for r in records if r.origin < split]
        eval_ = [r for r in records if r.origin >= split]
    else:
        calib = eval_ = records

    calib_q = _residual_quantiles_by_step(calib, horizon)

    # Evaluate pinball + coverage on the held-out eval slice.
    # Keys match QUANTILES = (0.075, 0.5, 0.925) — p7.5 / p50 / p92.5.
    _q_lo, _q_hi = QUANTILES[0], QUANTILES[2]
    pinballs, lowers, uppers, actuals = [], [], [], []
    for r in eval_:
        q = calib_q[r.step]
        p_lo, p50, p_hi = r.pred + q[_q_lo], r.pred + q[0.5], r.pred + q[_q_hi]
        lowers.append(p_lo)
        uppers.append(p_hi)
        actuals.append(r.actual)
        pinballs.append(
            np.mean(
                [
                    metrics.pinball_loss(np.array([r.actual]), np.array([r.pred + q[ql]]), ql)
                    for ql in QUANTILES
                ]
            )
        )
    cov = metrics.coverage(np.array(actuals), np.array(lowers), np.array(uppers)) if actuals else float("nan")

    # Final forecast: refit selected model on the full series; calibrate bands on all residuals.
    final_q = _residual_quantiles_by_step(records, horizon)
    point = best_model(y, horizon)
    future_index = pd.date_range(index[-1], periods=horizon + 1, freq="W")[1:]
    forecast_points = [
        ForecastPoint(
            period=future_index[i].date(),
            p10=round(float(point[i] + final_q[i + 1][_q_lo]), 2),
            p50=round(float(point[i] + final_q[i + 1][0.5]), 2),
            p90=round(float(point[i] + final_q[i + 1][_q_hi]), 2),
        )
        for i in range(horizon)
    ]

    return SeriesForecast(
        name=name,
        label=label,
        unit=unit,
        model=best_id,
        candidates={k: round(v, 4) for k, v in candidate_mase.items()},
        metrics=BacktestMetrics(
            mase=round(candidate_mase[best_id], 4),
            pinball=round(float(np.mean(pinballs)), 2) if pinballs else float("nan"),
            coverage_85=round(cov, 3),
            n_origins=len(origins_sorted),
        ),
        history=[
            HistoryPoint(period=index[i].date(), value=round(float(y[i]), 2))
            for i in range(y.size)
        ],
        forecast=forecast_points,
    )


def _short_series_forecast(y, index, name, label, horizon, unit) -> SeriesForecast:
    last = float(y[-1]) if y.size else 0.0
    spread = float(np.std(y)) if y.size > 1 else abs(last) * 0.25
    future_index = pd.date_range(index[-1], periods=horizon + 1, freq="W")[1:] if len(index) else pd.date_range("2026-01-04", periods=horizon, freq="W")
    forecast_points = [
        ForecastPoint(
            period=future_index[i].date(),
            p10=round(last - 1.28 * spread, 2),
            p50=round(last, 2),
            p90=round(last + 1.28 * spread, 2),
        )
        for i in range(horizon)
    ]
    return SeriesForecast(
        name=name,
        label=label,
        unit=unit,
        model="naive",
        candidates={"naive": float("nan")},
        metrics=BacktestMetrics(mase=float("nan"), pinball=float("nan"), coverage_85=float("nan"), n_origins=0),
        history=[HistoryPoint(period=index[i].date(), value=round(float(y[i]), 2)) for i in range(len(index))],
        forecast=forecast_points,
    )
