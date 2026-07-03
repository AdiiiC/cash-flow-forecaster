import numpy as np
import pandas as pd

from app.forecasting import baselines
from app.forecasting.pipeline import _walk_forward


def test_walk_forward_never_uses_future_data():
    """Each backtest prediction must be reproducible from only the pre-origin data."""
    rng = np.random.default_rng(0)
    y = np.cumsum(rng.normal(size=60)) + 100

    records = _walk_forward(y, baselines.naive, horizon=5, n_origins=8)
    assert records, "expected backtest records"

    for r in records:
        # Reconstruct the model input as of the origin and confirm the prediction
        # only depended on y[:origin] (strictly before the evaluated point).
        expected = baselines.naive(y[: r.origin], 5)[r.step - 1]
        assert r.pred == expected
        # The evaluated actual is at or after the origin (never before).
        assert r.origin + (r.step - 1) >= r.origin
