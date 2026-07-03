"""Grounded narrative generation.

The LLM is only ever a *phrasing* layer over numbers the forecasting engine
produced. Before returning any LLM text we verify that every number it emitted
exists in the allowed set (within tolerance). If it hallucinates a figure, we
discard the LLM output and return the deterministic template instead — the UI
is never shown an unverifiable number.
"""
from __future__ import annotations

import json
import re

from app.llm import provider
from app.schemas import Narrative

# Matches currency/number-like tokens: 1,234.56  $80000  12.3  -4500
_NUMBER_RE = re.compile(r"-?\$?\d[\d,]*(?:\.\d+)?")


def _extract_numbers(text: str) -> list[float]:
    values: list[float] = []
    for tok in _NUMBER_RE.findall(text):
        cleaned = tok.replace("$", "").replace(",", "")
        try:
            values.append(float(cleaned))
        except ValueError:
            continue
    return values


def _is_grounded(text: str, allowed: dict[str, float], tol: float = 0.01) -> bool:
    """True if every number in ``text`` matches an allowed value within tolerance.

    Small integers (years, counts like the horizon) are permitted since they
    are structural, not fabricated financial figures.
    """
    allowed_vals = list(allowed.values())
    for n in _extract_numbers(text):
        if 0 <= n <= 520 and float(n).is_integer():
            continue  # weeks/horizon/small counts
        ok = any(
            abs(n - a) <= max(tol * max(abs(a), 1.0), 0.5) for a in allowed_vals
        )
        if not ok:
            return False
    return True


def _template(values: dict[str, float], currency: str) -> str:
    def fmt(key: str) -> str:
        v = values.get(key, 0.0)
        return f"{currency} {v:,.0f}"

    runway = values.get("runway_weeks")
    runway_txt = (
        f"At the current trajectory, projected cash turns negative in about "
        f"{runway:.0f} weeks."
        if runway is not None
        else "The business remains cash-positive across the full forecast horizon."
    )
    return (
        f"Over the next {int(values.get('horizon_weeks', 13))} weeks, net cash flow is "
        f"forecast at a median of {fmt('net_p50_total')}, with inflows of {fmt('inflow_p50_total')} "
        f"against outflows of {fmt('outflow_p50_total')}. Projected closing cash balance is "
        f"{fmt('projected_balance_p50')}, versus an opening balance of {fmt('opening_balance')}. "
        f"{runway_txt} Recurring revenue (MRR) is tracking near {fmt('mrr_latest')} per month."
    )


def build_narrative(values: dict[str, float], currency: str) -> Narrative:
    template_text = _template(values, currency)

    try:
        brief = json.dumps({"currency": currency, **values}, default=float)
        prompt = (
            "Write the CFO briefing from this JSON brief. Use only these numbers.\n"
            f"{brief}"
        )
        result = provider.generate(prompt)
    except provider.LLMUnavailable:
        return Narrative(
            text=template_text, source="template", model=None, grounded=True, used_values=values
        )

    if _is_grounded(result.text, values):
        return Narrative(
            text=result.text,
            source=result.provider,
            model=result.model,
            grounded=True,
            used_values=values,
        )

    # Hallucination detected -> refuse the LLM text, serve the safe template.
    return Narrative(
        text=template_text, source="template", model=None, grounded=True, used_values=values
    )
