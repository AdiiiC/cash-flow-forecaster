"""Uncertainty-aware forecast metrics.

A forecasting project without these is vibe coding: point-error alone hides
bias, and ignoring the prediction interval hides overconfidence.
"""
from __future__ import annotations

import numpy as np


def naive_scale(insample: np.ndarray, season: int = 1) -> float:
    """Mean absolute error of the seasonal-naive forecast on the training data.

    This is the MASE denominator. Guarded against degenerate (flat) series.
    """
    insample = np.asarray(insample, dtype=float)
    if insample.size <= season:
        return 1.0
    diffs = np.abs(insample[season:] - insample[:-season])
    scale = float(np.mean(diffs))
    return scale if scale > 1e-9 else 1.0


def mase(actual: np.ndarray, forecast: np.ndarray, scale: float) -> float:
    actual = np.asarray(actual, dtype=float)
    forecast = np.asarray(forecast, dtype=float)
    if actual.size == 0:
        return float("nan")
    return float(np.mean(np.abs(actual - forecast)) / (scale if scale > 1e-9 else 1.0))


def pinball_loss(actual: np.ndarray, quantile_pred: np.ndarray, q: float) -> float:
    """Quantile (pinball) loss for a single quantile level q in (0, 1)."""
    actual = np.asarray(actual, dtype=float)
    quantile_pred = np.asarray(quantile_pred, dtype=float)
    diff = actual - quantile_pred
    return float(np.mean(np.maximum(q * diff, (q - 1.0) * diff)))


def coverage(actual: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> float:
    """Empirical share of actuals falling inside [lower, upper]."""
    actual = np.asarray(actual, dtype=float)
    lower = np.asarray(lower, dtype=float)
    upper = np.asarray(upper, dtype=float)
    if actual.size == 0:
        return float("nan")
    inside = (actual >= lower) & (actual <= upper)
    return float(np.mean(inside))
