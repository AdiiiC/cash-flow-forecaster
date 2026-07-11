"""Lightweight FX rate forecasting.

Model: horizon-adaptive drift + damped-Holt ensemble, EWMA volatility,
fat-tail interval correction.

Statistical efficiency rationale
---------------------------------
Three known inefficiencies in naive short-series FX forecasting are addressed:

1. Horizon-adaptive drift weight
   In liquid FX markets returns are close to a random walk (Efficient Market
   Hypothesis).  Trend signal from a 20-day drift decays quickly with horizon:
   the drift weight is exp(-h * ln2 / t_half) where t_half = 45 days.
   At h=7d the drift still contributes ~89%; at h=30d only ~63%; at h=90d
   only ~25%.  This shrinks the point estimate toward the martingale (spot)
   at long horizons where trend extrapolation adds bias with no accuracy gain.

2. EWMA volatility (RiskMetrics λ=0.94)
   A simple rolling-window average weights all observations equally.  FX
   returns exhibit volatility clustering (ARCH effects): recent squared
   returns are far more informative about near-future vol than returns from
   three weeks ago.  EWMA (λ=0.94) gives exponentially decaying weights,
   producing a more efficient variance estimator on daily financial series.

3. Fat-tail interval correction
   Gaussian z=1.645 assumes normal log-returns.  Major-pair FX returns have
   excess kurtosis ≈ 2-4 (Student-t with ≈7 df), meaning the 90% Gaussian
   interval systematically undercoveres in volatile regimes.  A multiplicative
   correction of 1.15 (derived from t_{0.95}(df=7) / z_{0.95} ≈ 2.00/1.645)
   widens the interval to give honest coverage without requiring an explicit
   df estimation on the short sample.

N ≤ 7 shortcut: model adds noise below a week; use spot ± 0.5% slippage.
"""
from __future__ import annotations

import math
from datetime import date
from typing import NamedTuple


class FxPrediction(NamedTuple):
    pair: str           # e.g. "USD/INR"
    horizon_days: int
    rate_p50: float     # ensemble point estimate
    rate_p10: float     # pessimistic bound (lower base receipt or higher cost)
    rate_p90: float     # optimistic bound
    spot_today: float   # latest close rate
    model: str          # identifier for audit / display
    as_of: date         # date on which prediction was made


_SLIPPAGE = 0.005         # 0.5% spot band for very short horizons (N ≤ 7)
_Z90 = 1.645              # Gaussian z for ~90% one-sided coverage
_TAIL_FACTOR = 1.15       # Student-t(df≈7) fat-tail correction for FX returns
_EWMA_LAMBDA = 0.94       # RiskMetrics exponential decay for variance
_DRIFT_HALFLIFE = 45.0    # days at which drift weight halves (≈ trend persistence)


def _ewma_sigma(log_returns: list[float]) -> float:
    """EWMA daily volatility (RiskMetrics λ=0.94).

    Initialise with the first squared return then update with exponential
    decay.  More responsive to recent vol spikes than a rolling window.
    """
    if not log_returns:
        return 0.005  # 0.5% daily fallback
    var = log_returns[0] ** 2
    for r in log_returns[1:]:
        var = _EWMA_LAMBDA * var + (1.0 - _EWMA_LAMBDA) * r * r
    return math.sqrt(max(var, 1e-12))


def predict(base: str, quote: str, horizon_days: int) -> FxPrediction:
    """Predict the *base*/*quote* rate at *horizon_days* from today.

    Returns a FxPrediction with p10/p50/p90 bounds.
    Raises ValueError if no history is available.
    Network errors propagate — callers should wrap in try/except.
    """
    from app.fx_history import fetch_history

    base, quote = base.upper(), quote.upper()
    pair = f"{base}/{quote}"
    history = fetch_history(base, quote, 90)
    rates = [p.rate for p in history]
    n = len(rates)

    if n == 0:
        raise ValueError(f"No rate history available for {pair}.")

    spot = rates[-1]

    # ── Short-horizon shortcut ─────────────────────────────────────────────
    if horizon_days <= 7:
        lo = round(spot * (1 - _SLIPPAGE), 4)
        hi = round(spot * (1 + _SLIPPAGE), 4)
        return FxPrediction(pair, horizon_days, round(spot, 4), lo, hi,
                            round(spot, 4), "spot_slippage", date.today())

    # ── Drift model ────────────────────────────────────────────────────────
    lookback = min(20, n - 1)
    daily_drift = (rates[-1] - rates[-(lookback + 1)]) / lookback if lookback else 0.0
    drift_pred = spot + daily_drift * horizon_days

    # ── Damped Holt (alpha=0.3, beta=0.1, phi=0.9) ────────────────────────
    alpha, beta, phi = 0.3, 0.1, 0.9
    lvl = rates[0]
    trend = (rates[1] - rates[0]) if n > 1 else 0.0
    for r in rates[1:]:
        l_prev, b_prev = lvl, trend
        lvl = alpha * r + (1.0 - alpha) * (l_prev + phi * b_prev)
        trend = beta * (lvl - l_prev) + (1.0 - beta) * phi * b_prev
    damp_sum = phi * (1.0 - phi ** horizon_days) / (1.0 - phi)
    holt_pred = lvl + damp_sum * trend

    # ── Horizon-adaptive ensemble weight ──────────────────────────────────
    # drift_weight decays with horizon; Holt (which damps its own trend via
    # phi) carries increasing weight at longer horizons — closer to martingale.
    drift_weight = math.exp(-horizon_days * math.log(2.0) / _DRIFT_HALFLIFE)
    p50 = drift_weight * drift_pred + (1.0 - drift_weight) * holt_pred

    # ── EWMA log-return volatility ─────────────────────────────────────────
    # Use all available history (up to 90 days) for a stable EWMA estimate.
    start_i = max(1, n - 90)
    log_returns = [
        math.log(rates[i] / rates[i - 1])
        for i in range(start_i, n)
        if rates[i - 1] > 0 and rates[i] > 0
    ]
    sigma_daily = _ewma_sigma(log_returns)

    # σ√h scaling; fat-tail correction for FX kurtosis (equivalent to t_df≈7)
    sigma_h = sigma_daily * math.sqrt(horizon_days) * _TAIL_FACTOR

    # Log-normal interval centred on p50
    p_lo = p50 * math.exp(-_Z90 * sigma_h)
    p_hi = p50 * math.exp(_Z90 * sigma_h)
    lo, hi = (p_lo, p_hi) if p_lo < p_hi else (p_hi, p_lo)

    return FxPrediction(
        pair=pair,
        horizon_days=horizon_days,
        rate_p50=round(p50, 4),
        rate_p10=round(lo, 4),
        rate_p90=round(hi, 4),
        spot_today=round(spot, 4),
        model="adaptive_ensemble_ewma",
        as_of=date.today(),
    )

