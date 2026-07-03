from app.llm import narrative
from app.llm import provider as llm_provider


def test_grounded_accepts_only_allowed_numbers():
    allowed = {"net": 12345.0, "mrr": 80000.0}
    text = "Net cash flow is 12,345 and MRR is 80000 per month."
    assert narrative._is_grounded(text, allowed)


def test_grounded_rejects_hallucinated_number():
    allowed = {"net": 12345.0}
    text = "Net cash flow is 12,345 but growth will hit 99999 next quarter."
    assert not narrative._is_grounded(text, allowed)


def test_template_is_always_grounded(monkeypatch):
    def _unavailable(_prompt):
        raise llm_provider.LLMUnavailable("disabled for test")

    # Force the deterministic template path regardless of ambient API keys.
    monkeypatch.setattr(llm_provider, "generate", _unavailable)

    values = {
        "horizon_weeks": 13.0,
        "opening_balance": 250000.0,
        "projected_balance_p50": 300000.0,
        "net_p50_total": 50000.0,
        "inflow_p50_total": 400000.0,
        "outflow_p50_total": 350000.0,
        "mrr_latest": 80000.0,
    }
    result = narrative.build_narrative(values, "USD")
    # Template path must self-certify grounded.
    assert result.source == "template"
    assert result.grounded is True
