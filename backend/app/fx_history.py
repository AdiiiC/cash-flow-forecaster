"""Fetch and cache 90-day daily FX close rates from frankfurter.app.

frankfurter.app is a free, key-free ECB/Bundesbank data mirror that covers
all major currency pairs including INR, USD, EUR, GBP, JPY, AED, SGD, etc.

The in-process cache has a 1-hour TTL — suitable for a single-instance
service. A Redis or DB cache would be the next step for horizontal scale.
All network calls use only stdlib; no new dependencies are added.
"""
from __future__ import annotations

import time
from datetime import date, timedelta
from typing import NamedTuple

_BASE_URL = "https://api.frankfurter.app"
_CACHE_TTL = 3600.0  # seconds
_cache: dict[str, tuple[float, list]] = {}


class RatePoint(NamedTuple):
    day: date
    rate: float


def _request(base: str, quote: str, days: int) -> list[RatePoint]:
    end = date.today()
    start = end - timedelta(days=days + 30)
    url = (
        f"{_BASE_URL}/{start}..{end}"
        f"?base={base.upper()}&symbols={quote.upper()}"
    )
    import httpx
    resp = httpx.get(
        url,
        headers={"User-Agent": "CashFlowForecaster/1.0", "Accept": "application/json"},
        timeout=10,
    )
    body = resp.json()

    q = quote.upper()
    raw: dict[str, dict] = body.get("rates", {})
    points = sorted(
        [
            RatePoint(date.fromisoformat(d), float(v[q]))
            for d, v in raw.items()
            if q in v
        ],
        key=lambda p: p.day,
    )
    # Return only the last *days* trading sessions
    return points[-days:]


def fetch_history(base: str, quote: str, days: int = 90) -> list[RatePoint]:
    """Return up to *days* daily close rates, cached for 1 hour.

    If base == quote the rate is trivially 1.0 throughout.
    Network errors surface so callers can fall back gracefully.
    """
    base, quote = base.upper(), quote.upper()
    if base == quote:
        today = date.today()
        return [RatePoint(today - timedelta(days=i), 1.0) for i in range(days - 1, -1, -1)]

    key = f"{base}/{quote}"
    now = time.monotonic()
    if key in _cache:
        ts, data = _cache[key]
        if now - ts < _CACHE_TTL:
            return data  # type: ignore[return-value]

    data = _request(base, quote, days)
    _cache[key] = (now, data)
    return data  # type: ignore[return-value]


def spot_rate(base: str, quote: str) -> float:
    """Latest close rate (last point of a short history fetch)."""
    history = fetch_history(base, quote, 7)
    return history[-1].rate if history else 1.0
