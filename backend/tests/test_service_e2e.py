from app.data.synthetic import generate_ledger
from app.service import build_forecast


def test_end_to_end_demo_forecast_is_well_formed():
    ledger = generate_ledger(weeks=104, seed=7)
    resp = build_forecast(ledger, horizon=13)

    assert resp.horizon_weeks == 13
    assert len(resp.series) == 4
    for s in resp.series:
        assert len(s.forecast) == 13
        # Prediction interval must be ordered: p10 <= p50 <= p90.
        for p in s.forecast:
            assert p.p10 <= p.p50 <= p.p90
    # Narrative must be present and grounded.
    assert resp.narrative.grounded is True
    assert resp.narrative.text
