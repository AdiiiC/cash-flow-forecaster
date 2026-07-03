import numpy as np

from app.forecasting import baselines


def test_naive_repeats_last():
    y = np.array([1.0, 2.0, 3.0])
    assert list(baselines.naive(y, 3)) == [3.0, 3.0, 3.0]


def test_drift_extrapolates_trend():
    y = np.array([0.0, 1.0, 2.0, 3.0])
    out = baselines.drift(y, 2)
    assert np.allclose(out, [4.0, 5.0])


def test_holt_tracks_linear_trend():
    y = np.arange(0, 20, dtype=float)
    out = baselines.holt(y, 3)
    # Should keep increasing roughly linearly.
    assert out[0] < out[1] < out[2]


def test_default_models_include_baselines():
    models = baselines.default_models(season=1)
    assert {"naive", "drift", "holt", "gbm"}.issubset(models.keys())
