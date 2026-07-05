"""Fold user-scheduled recurring cash events into the baseline forecast.

Like :mod:`app.scenario`, this is a transparent, deterministic overlay on the
*point* forecast — it does not re-run the backtest. Each recurring item (payroll,
rent, a SaaS subscription, a retainer) is expanded into concrete occurrences
inside the forecast window and added to the week it lands in. Balance, runway,
and the runway insight are then recomputed so the headline numbers reflect known
future obligations, not just the statistical projection.
"""
from __future__ import annotations

import calendar
from datetime import date, timedelta

from app.insights import build_insight
from app.schemas import (
    Cadence,
    Direction,
    ForecastResponse,
    RecurringImpact,
    RecurringItem,
)


def _add_months(d: date, months: int) -> date:
    """Add whole months, clamping the day to the target month's last day."""
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _nth(anchor: date, cadence: Cadence, k: int) -> date:
    """The k-th occurrence (k>=0) measured from the anchor, without drift.

    Monthly/quarterly are anchored to the original day-of-month (clamped to the
    target month's length) so "rent on the 31st" stays on month-end rather than
    creeping earlier over time.
    """
    if cadence == Cadence.weekly:
        return anchor + timedelta(days=7 * k)
    if cadence == Cadence.biweekly:
        return anchor + timedelta(days=14 * k)
    if cadence == Cadence.monthly:
        return _add_months(anchor, k)
    if cadence == Cadence.quarterly:
        return _add_months(anchor, 3 * k)
    raise ValueError(f"Unknown cadence: {cadence}")


def occurrences(anchor: date, cadence: Cadence, start: date, end: date) -> list[date]:
    """All occurrence dates in [start, end], measured from ``anchor`` by cadence.

    ``anchor`` may be before ``start`` (we skip early occurrences) or inside the
    window. A hard cap keeps a misconfigured item from looping forever.
    """
    if end < start:
        return []
    out: list[date] = []
    for k in range(5000):
        d = _nth(anchor, cadence, k)
        if d > end:
            break
        if d >= start:
            out.append(d)
    return out


def _bucket_index(periods: list[date], when: date) -> int | None:
    """Index of the first forecast week (week-ending date) that contains ``when``."""
    for i, p in enumerate(periods):
        if when <= p:
            return i
    return None


def apply_recurring(response: ForecastResponse, items: list[RecurringItem]) -> ForecastResponse:
    """Mutate ``response`` in place, folding active recurring items into it.

    Returns the same response for convenience. Sets ``response.recurring`` to a
    summary and updates net/inflow/outflow series, balance, runway, and insight.
    """
    active = [i for i in items if i.active]
    series_by_name = {s.name: s for s in response.series}
    net = series_by_name.get("net_cash_flow")
    if net is None or not net.forecast:
        response.recurring = RecurringImpact(count=0, inflow_total=0.0, outflow_total=0.0, net_total=0.0)
        return response

    periods = [p.period for p in net.forecast]
    window_start = response.as_of
    window_end = periods[-1]

    inflow = series_by_name.get("inflow")
    outflow = series_by_name.get("outflow")

    inflow_total = 0.0
    outflow_total = 0.0
    applied_count = 0

    for item in active:
        occ = occurrences(item.anchor_date, item.cadence, window_start, window_end)
        if not occ:
            continue
        applied_count += 1
        sign = 1.0 if item.direction == Direction.inflow else -1.0
        for when in occ:
            idx = _bucket_index(periods, when)
            if idx is None:
                continue
            # Add the signed amount to the net projection (shifts p10/p50/p90 together).
            pt = net.forecast[idx]
            pt.p10 = round(pt.p10 + sign * item.amount, 2)
            pt.p50 = round(pt.p50 + sign * item.amount, 2)
            pt.p90 = round(pt.p90 + sign * item.amount, 2)
            # Reflect it in the matching gross series so charts stay coherent.
            if item.direction == Direction.inflow:
                inflow_total += item.amount
                if inflow is not None and idx < len(inflow.forecast):
                    ip = inflow.forecast[idx]
                    ip.p10 = round(ip.p10 + item.amount, 2)
                    ip.p50 = round(ip.p50 + item.amount, 2)
                    ip.p90 = round(ip.p90 + item.amount, 2)
            else:
                outflow_total += item.amount
                if outflow is not None and idx < len(outflow.forecast):
                    op = outflow.forecast[idx]
                    op.p10 = round(op.p10 + item.amount, 2)
                    op.p50 = round(op.p50 + item.amount, 2)
                    op.p90 = round(op.p90 + item.amount, 2)

    # Recompute headline balance + runway from the adjusted net p50 path.
    balance = response.opening_balance
    runway_weeks: float | None = None
    for i, pt in enumerate(net.forecast, start=1):
        balance += pt.p50
        if balance < 0 and runway_weeks is None:
            runway_weeks = float(i)
    response.projected_balance_p50 = round(balance, 2)
    response.runway_weeks = runway_weeks

    # Rebuild the deterministic insight so runway coaching matches the new numbers.
    response.insight = build_insight(
        as_of=response.as_of,
        opening_balance=response.opening_balance,
        net_forecast=net.forecast,
        runway_weeks=runway_weeks,
        horizon=response.horizon_weeks,
        currency=response.currency,
    )

    response.recurring = RecurringImpact(
        count=applied_count,
        inflow_total=round(inflow_total, 2),
        outflow_total=round(outflow_total, 2),
        net_total=round(inflow_total - outflow_total, 2),
    )
    return response
