"""Live FX spot rates via frankfurter.app (ECB/Bundesbank data, no API key).

The in-process cache has a 15-minute TTL so rates are always recent but we
don't hammer the upstream on every request.  Falls back to the last known
rates (or hard-coded fallback) on network failure so the service keeps
running even when the FX feed is temporarily unavailable.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.schemas import FxRates

_BASE_URL = "https://api.frankfurter.app"
_CACHE_TTL = 900.0  # 15 minutes

# Symbols we always fetch (USD is implicit as the base)
_SYMBOLS = "INR,EUR,GBP,AED,SGD,JPY,AUD,CAD,CHF,CNY"

# Fallback rates (indicative mid-market) used if the live fetch fails
_FALLBACK: dict[str, float] = {
    "USD": 1.0,
    "INR": 83.5,
    "EUR": 0.92,
    "GBP": 0.79,
    "AED": 3.67,
    "SGD": 1.34,
    "JPY": 155.0,
    "AUD": 1.53,
    "CAD": 1.37,
    "CHF": 0.90,
    "CNY": 7.25,
}

# (_rates, fetched_at_monotonic, fetched_at_utc)
_cache: tuple[dict[str, float], float, datetime] | None = None


def _fetch_live() -> tuple[dict[str, float], datetime]:
    """Fetch latest rates from frankfurter.app.  Returns (rates, fetched_at)."""
    url = f"{_BASE_URL}/latest?base=USD&symbols={_SYMBOLS}"
    resp = httpx.get(
        url,
        headers={"User-Agent": "CashFlowForecaster/1.0", "Accept": "application/json"},
        timeout=8,
    )
    body: dict[str, Any] = resp.json()
    raw: dict[str, float] = body.get("rates", {})
    rates = {"USD": 1.0, **{k.upper(): float(v) for k, v in raw.items()}}
    return rates, datetime.now(timezone.utc)


def get_rates() -> FxRates:
    """Return live spot rates, refreshing from the upstream at most every 15 min."""
    global _cache
    now = time.monotonic()

    if _cache is not None:
        rates, cached_at, fetched_at = _cache
        if now - cached_at < _CACHE_TTL:
            return FxRates(base="USD", rates=rates,
                           as_of=fetched_at.date(), fetched_at=fetched_at)

    try:
        rates, fetched_at = _fetch_live()
        _cache = (rates, now, fetched_at)
    except Exception:  # noqa: BLE001 — keep running on network failure
        if _cache is not None:
            rates, _, fetched_at = _cache
        else:
            rates = dict(_FALLBACK)
            fetched_at = datetime.now(timezone.utc)

    return FxRates(base="USD", rates=rates,
                   as_of=fetched_at.date(), fetched_at=fetched_at)


def convert(amount: float, from_code: str, to_code: str) -> float:
    """Convert *amount* from one currency to another using live spot rates."""
    fx = get_rates()
    frm = fx.rates.get(from_code.upper(), 1.0)
    to = fx.rates.get(to_code.upper(), 1.0)
    return amount / frm * to
