import numpy as np

from app.forecasting import metrics


def test_mase_zero_for_perfect_forecast():
    actual = np.array([10.0, 12.0, 14.0])
    assert metrics.mase(actual, actual, scale=2.0) == 0.0


def test_naive_scale_handles_flat_series():
    # A perfectly flat series would give scale 0; guard returns 1.0.
    assert metrics.naive_scale(np.array([5.0, 5.0, 5.0])) == 1.0


def test_pinball_penalizes_asymmetrically():
    actual = np.array([10.0])
    # Under-forecast at the 0.9 quantile should be penalized heavily.
    high_q_under = metrics.pinball_loss(actual, np.array([8.0]), 0.9)
    high_q_over = metrics.pinball_loss(actual, np.array([12.0]), 0.9)
    assert high_q_under > high_q_over


def test_coverage_fraction():
    actual = np.array([1.0, 2.0, 3.0, 4.0])
    lower = np.array([0.0, 0.0, 5.0, 0.0])
    upper = np.array([2.0, 3.0, 6.0, 10.0])
    # 3 of 4 inside.
    assert metrics.coverage(actual, lower, upper) == 0.75
