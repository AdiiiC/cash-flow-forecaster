"""Tiny in-process LRU cache for expensive base forecasts.

Only the costly base forecast (the ~20s backtest) is cached. Cheap per-request
post-processing (scenario overlay, threshold alerts, FX) is always recomputed,
so toggling those never returns stale derived state.
"""
from __future__ import annotations

import threading
from collections import OrderedDict
from typing import Callable

from app.schemas import ForecastResponse

_MAX = 32
_LOCK = threading.Lock()
_STORE: "OrderedDict[str, ForecastResponse]" = OrderedDict()


def get_or_build(key: str, build: Callable[[], ForecastResponse]) -> tuple[ForecastResponse, bool]:
    """Return (response, cached). ``build`` runs only on a miss."""
    with _LOCK:
        hit = _STORE.get(key)
        if hit is not None:
            _STORE.move_to_end(key)
            return hit.model_copy(deep=True), True

    # Build outside the lock so a slow forecast doesn't block cache reads.
    result = build()

    with _LOCK:
        _STORE[key] = result
        _STORE.move_to_end(key)
        while len(_STORE) > _MAX:
            _STORE.popitem(last=False)
    return result.model_copy(deep=True), False


def clear() -> None:
    with _LOCK:
        _STORE.clear()
