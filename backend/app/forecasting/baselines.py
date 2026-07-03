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


def _lag_matrix(y: np.ndarray, n_lags: int) -> tuple[np.ndarray, np.ndarray]:
    rows, targets = [], []
    for i in range(n_lags, y.size):
        rows.append(y[i - n_lags : i])
        targets.append(y[i])
    return np.asarray(rows), np.asarray(targets)


def gbm(n_lags: int = 8) -> Model:
    """Gradient-boosted regressor on lagged values, forecast recursively."""

    def _fn(y: np.ndarray, horizon: int) -> np.ndarray:
        if y.size <= n_lags + 4:
            return holt(y, horizon)
        X, target = _lag_matrix(y, n_lags)
        model = HistGradientBoostingRegressor(
            max_depth=3, max_iter=150, learning_rate=0.08, random_state=0
        )
        model.fit(X, target)
        window = list(y[-n_lags:])
        preds = []
        for _ in range(horizon):
            nxt = float(model.predict(np.asarray(window[-n_lags:]).reshape(1, -1))[0])
            preds.append(nxt)
            window.append(nxt)
        return np.asarray(preds)

    _fn.__name__ = f"gbm_lag{n_lags}"
    return _fn


def default_models(season: int) -> dict[str, Model]:
    models: dict[str, Model] = {
        "naive": naive,
        "drift": drift,
        "holt": holt,
        "gbm": gbm(),
    }
    if season > 1:
        models[f"seasonal_naive_{season}"] = seasonal_naive(season)
    return models
