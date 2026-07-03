"""Deterministic, businessman-facing insights derived from the base forecast.

No LLM and no randomness — every recommendation is a transparent arithmetic
consequence of the projected numbers, so it can be audited and trusted.
"""
from __future__ import annotations

from datetime import date, timedelta

from app.schemas import ForecastPoint, Recommendation, RunwayInsight

_WEEKS_PER_MONTH = 4.33
_TARGET_RUNWAY_WEEKS = 52.0  # the "healthy" runway we coach toward (~12 months)

_SYMBOLS = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥"}


def _fmt(amount: float, currency: str) -> str:
    symbol = _SYMBOLS.get(currency.upper(), "")
    return f"{symbol}{abs(amount):,.0f}"


def build_insight(
    *,
    as_of: date,
    opening_balance: float,
    net_forecast: list[ForecastPoint],
    runway_weeks: float | None,
    horizon: int,
    currency: str,
) -> RunwayInsight:
    """Translate the raw net-cash-flow projection into runway + next steps."""
    solvent = runway_weeks is None
    runway_months = (
        None if runway_weeks is None else round(runway_weeks / _WEEKS_PER_MONTH, 1)
    )
    runway_date = (
        None
        if runway_weeks is None
        else as_of + timedelta(weeks=int(round(runway_weeks)))
    )

    net_total = sum(p.p50 for p in net_forecast)
    mean_weekly_net = net_total / horizon if horizon else 0.0
    recs: list[Recommendation] = []

    if not solvent and runway_weeks is not None:
        burn = -mean_weekly_net  # positive weekly cash burn
        if burn > 0 and opening_balance > 0:
            needed_burn = opening_balance / _TARGET_RUNWAY_WEEKS
            cut_per_week = burn - needed_burn
            if cut_per_week > 0:
                monthly_cut = cut_per_week * _WEEKS_PER_MONTH
                recs.append(
                    Recommendation(
                        kind="cut",
                        message=(
                            f"Cut about {_fmt(monthly_cut, currency)}/mo in costs "
                            f"to reach ~12 months of runway."
                        ),
                        value=round(monthly_cut, 2),
                    )
                )
        if runway_date is not None:
            recs.append(
                Recommendation(
                    kind="info",
                    message=(
                        f"At the current pace, cash runs out around "
                        f"{runway_date:%b %d, %Y} (~{runway_months} months)."
                    ),
                )
            )
    else:
        recs.append(
            Recommendation(
                kind="info",
                message=f"You stay cash-positive across the {horizon}-week horizon.",
            )
        )
        surplus_month = mean_weekly_net * _WEEKS_PER_MONTH
        if surplus_month > 0:
            recs.append(
                Recommendation(
                    kind="afford",
                    message=(
                        f"You could absorb roughly {_fmt(surplus_month, currency)}/mo "
                        f"in new spend and still end the horizon positive."
                    ),
                    value=round(surplus_month, 2),
                )
            )

    return RunwayInsight(
        runway_weeks=runway_weeks,
        runway_months=runway_months,
        runway_date=runway_date,
        solvent=solvent,
        recommendations=recs,
    )
