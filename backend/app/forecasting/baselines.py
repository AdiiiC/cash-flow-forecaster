"""Point-forecast models: mandatory baselines plus a small ML learner.

Every model exposes the same signature: ``fit_predict(y, horizon) -> np.ndarray``
of length ``horizon``. The baselines exist so no fancy model ships without
being measured against them (MASE < 1 or it does not earn its complexity).
"""
from __future__ import annotations

from typing import Callable

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

Model = Callable[[np.ndarray, int], np.ndarray]


def naive(y: np.ndarray, horizon: int) -> np.ndarray:
    return np.repeat(y[-1], horizon)


def drift(y: np.ndarray, horizon: int) -> np.ndarray:
    if y.size < 2:
        return naive(y, horizon)
    slope = (y[-1] - y[0]) / (y.size - 1)
    return y[-1] + slope * np.arange(1, horizon + 1)


def seasonal_naive(season: int) -> Model:
    def _fn(y: np.ndarray, horizon: int) -> np.ndarray:
        if y.size < season:
            return naive(y, horizon)
        last_season = y[-season:]
        reps = int(np.ceil(horizon / season))
        return np.tile(last_season, reps)[:horizon]

    _fn.__name__ = f"seasonal_naive_{season}"
    return _fn


def holt(y: np.ndarray, horizon: int, alpha: float = 0.4, beta: float = 0.1) -> np.ndarray:
    """Holt's linear trend (double exponential smoothing), implemented directly.

    Dependency-light and robust for short weekly series.
    """
    if y.size < 2:
        return naive(y, horizon)
    level = y[0]
    trend = y[1] - y[0]
    for value in y[1:]:
        prev_level = level
        level = alpha * value + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
    return level + trend * np.arange(1, horizon + 1)


def damped_holt(
    y: np.ndarray,
    horizon: int,
    alpha: float = 0.4,
    beta: float = 0.1,
    phi: float = 0.9,
) -> np.ndarray:
    """Damped-trend exponential smoothing.

    Like Holt, but the trend is discounted by ``phi`` each step ahead so the
    forecast flattens instead of extrapolating a straight line indefinitely.
    This is a much safer default than plain Holt on noisy business series and
    frequently wins on MASE when the recent trend is not sustainable.
    """
    if y.size < 2:
        return naive(y, horizon)
    level = y[0]
    trend = y[1] - y[0]
    for value in y[1:]:
        prev_level = level
        level = alpha * value + (1 - alpha) * (level + phi * trend)
        trend = beta * (level - prev_level) + (1 - beta) * phi * trend
    steps = np.arange(1, horizon + 1)
    damp = np.cumsum(phi ** steps)  # phi + phi^2 + ... + phi^h
    return level + trend * damp


def theta(y: np.ndarray, horizon: int, alpha: float = 0.5) -> np.ndarray:
    """Classic Theta method (Assimakopoulos & Nikolopoulos, 2000).

    Decomposes the series into a long-run linear trend (theta=0 line) and a
    curvature-amplified component (theta=2 line) smoothed by SES, then averages
    the two. A remarkably strong, cheap general-purpose forecaster — it won the
    M3 competition — so it makes an excellent additional baseline to beat.
    """
    n = y.size
    if n < 4:
        return holt(y, horizon)
    t = np.arange(n, dtype=float)
    # Ordinary least-squares trend (the theta=0 line).
    design = np.vstack([t, np.ones(n)]).T
    slope, intercept = np.linalg.lstsq(design, y, rcond=None)[0]
    # theta=2 line doubles the curvature around the trend, smoothed by SES.
    theta2 = 2.0 * y - (intercept + slope * t)
    level = theta2[0]
    for value in theta2[1:]:
        level = alpha * value + (1 - alpha) * level
    fut = np.arange(n, n + horizon, dtype=float)
    trend_fc = intercept + slope * fut
    ses_fc = np.repeat(level, horizon)
    return 0.5 * ses_fc + 0.5 * trend_fc


def _fourier_features(idx: float) -> np.ndarray:
    """Cyclical calendar features for a weekly index (bounded, so trees can use
    them for seasonality). We deliberately omit a raw trend index: tree models
    cannot extrapolate a monotone feature beyond its training range, so trend is
    carried by the autoregressive lags instead."""
    return np.array(
        [
            np.sin(2 * np.pi * idx / 52.0), np.cos(2 * np.pi * idx / 52.0),   # annual
            np.sin(2 * np.pi * idx / 13.0), np.cos(2 * np.pi * idx / 13.0),   # quarterly
            np.sin(2 * np.pi * idx / 4.345), np.cos(2 * np.pi * idx / 4.345),  # ~monthly
        ]
    )


def _lag_feature_matrix(y: np.ndarray, n_lags: int) -> tuple[np.ndarray, np.ndarray]:
    rows, targets = [], []
    for i in range(n_lags, y.size):
        feats = np.concatenate([y[i - n_lags : i], _fourier_features(i)])
        rows.append(feats)
        targets.append(y[i])
    return np.asarray(rows), np.asarray(targets)


def gbm(n_lags: int = 8) -> Model:
    """Gradient-boosted regressor on lagged values plus cyclical calendar
    features, forecast recursively."""

    def _fn(y: np.ndarray, horizon: int) -> np.ndarray:
        n = y.size
        if n <= n_lags + 6:
            return holt(y, horizon)
        X, target = _lag_feature_matrix(y, n_lags)
        model = HistGradientBoostingRegressor(
            max_depth=3, max_iter=200, learning_rate=0.07, random_state=0
        )
        model.fit(X, target)
        window = list(y[-n_lags:])
        preds = []
        for h in range(horizon):
            feats = np.concatenate(
                [np.asarray(window[-n_lags:], dtype=float), _fourier_features(n + h)]
            )
            nxt = float(model.predict(feats.reshape(1, -1))[0])
            preds.append(nxt)
            window.append(nxt)
        return np.asarray(preds)

    _fn.__name__ = f"gbm_lag{n_lags}"
    return _fn


def ensemble(y: np.ndarray, horizon: int) -> np.ndarray:
    """Equal-weight average of the cheap structural models.

    Averaging decorrelated forecasters reduces variance and is a robust way to
    avoid betting everything on one model that happens to overfit a backtest.
    Kept GBM-free so it stays cheap in the walk-forward loop.
    """
    parts = [
        drift(y, horizon),
        holt(y, horizon),
        damped_holt(y, horizon),
        theta(y, horizon),
    ]
    return np.mean(parts, axis=0)


def default_models(season: int = 1, n_obs: int = 0) -> dict[str, Model]:
    models: dict[str, Model] = {
        "naive": naive,
        "drift": drift,
        "holt": holt,
        "damped_holt": damped_holt,
        "theta": theta,
        "gbm": gbm(),
        "ensemble": ensemble,
    }
    # Seasonal-naive baselines only when there is enough history to define the
    # cycle; the MASE selection will pick them only if they actually help.
    if n_obs >= 26:
        models["seasonal_naive_13"] = seasonal_naive(13)
    if n_obs >= 104:
        models["seasonal_naive_52"] = seasonal_naive(52)
    if season > 1:
        models[f"seasonal_naive_{season}"] = seasonal_naive(season)
    return models
