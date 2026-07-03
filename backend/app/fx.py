"""Static FX rates for display-side currency conversion.

Rates are indicative and fixed (no live feed) — conversion in the UI is always
labeled with the rate used, so a converted figure is never mistaken for a
natively-denominated one.
"""
from __future__ import annotations

from datetime import date

from app.schemas import FxRates

# Units of the quoted currency per 1 USD. Indicative mid-market levels.
_RATES: dict[str, float] = {
    "USD": 1.0,
    "INR": 83.0,
}

_AS_OF = date(2026, 7, 1)


def get_rates() -> FxRates:
    return FxRates(base="USD", rates=dict(_RATES), as_of=_AS_OF)


def convert(amount: float, from_code: str, to_code: str) -> float:
    frm = _RATES.get(from_code.upper(), 1.0)
    to = _RATES.get(to_code.upper(), 1.0)
    usd = amount / frm
    return usd * to
