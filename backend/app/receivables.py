"""Fold open invoices (AR) and bills (AP) into the baseline forecast.

Each open receivable is expected cash *in* on its due date; each open payable is
expected cash *out*. Like recurring items, this is a transparent overlay on the
point forecast — it adds the amount to the forecast week the due date lands in
and recomputes balance/runway. Items already past due (open but due before the
forecast starts) are treated as imminent and bucketed into the first week.
"""
from __future__ import annotations

from datetime import date

from app.insights import build_insight
from app.schemas import ForecastResponse, Invoice, InvoiceImpact, InvoiceKind, InvoiceStatus


def _bucket_index(periods: list[date], when: date) -> int:
    """Forecast-week index for a due date; past-due items land in week 0."""
    for i, p in enumerate(periods):
        if when <= p:
            return i
    return len(periods) - 1  # due within the last week's window


def apply_receivables(response: ForecastResponse, invoices: list[Invoice]) -> ForecastResponse:
    """Mutate ``response`` in place, folding open AR/AP into it. Returns it."""
    series_by_name = {s.name: s for s in response.series}
    net = series_by_name.get("net_cash_flow")
    if net is None or not net.forecast:
        response.receivables = InvoiceImpact(
            count=0, overdue_count=0, expected_inflow=0.0, expected_outflow=0.0, net_total=0.0
        )
        return response

    periods = [p.period for p in net.forecast]
    window_start = response.as_of
    window_end = periods[-1]
    today = date.today()

    inflow = series_by_name.get("inflow")
    outflow = series_by_name.get("outflow")

    expected_inflow = 0.0
    expected_outflow = 0.0
    count = 0
    overdue_count = 0

    for inv in invoices:
        if inv.status != InvoiceStatus.open:
            continue
        # Only items due within (or before) the forecast window affect it.
        if inv.due_date > window_end:
            continue
        count += 1
        if inv.due_date < today:
            overdue_count += 1
        landing = max(inv.due_date, window_start)
        idx = _bucket_index(periods, landing)
        sign = 1.0 if inv.kind == InvoiceKind.receivable else -1.0

        pt = net.forecast[idx]
        pt.p10 = round(pt.p10 + sign * inv.amount, 2)
        pt.p50 = round(pt.p50 + sign * inv.amount, 2)
        pt.p90 = round(pt.p90 + sign * inv.amount, 2)

        if inv.kind == InvoiceKind.receivable:
            expected_inflow += inv.amount
            if inflow is not None and idx < len(inflow.forecast):
                ip = inflow.forecast[idx]
                ip.p10 = round(ip.p10 + inv.amount, 2)
                ip.p50 = round(ip.p50 + inv.amount, 2)
                ip.p90 = round(ip.p90 + inv.amount, 2)
        else:
            expected_outflow += inv.amount
            if outflow is not None and idx < len(outflow.forecast):
                op = outflow.forecast[idx]
                op.p10 = round(op.p10 + inv.amount, 2)
                op.p50 = round(op.p50 + inv.amount, 2)
                op.p90 = round(op.p90 + inv.amount, 2)

    balance = response.opening_balance
    runway_weeks: float | None = None
    for i, pt in enumerate(net.forecast, start=1):
        balance += pt.p50
        if balance < 0 and runway_weeks is None:
            runway_weeks = float(i)
    response.projected_balance_p50 = round(balance, 2)
    response.runway_weeks = runway_weeks

    response.insight = build_insight(
        as_of=response.as_of,
        opening_balance=response.opening_balance,
        net_forecast=net.forecast,
        runway_weeks=runway_weeks,
        horizon=response.horizon_weeks,
        currency=response.currency,
    )

    response.receivables = InvoiceImpact(
        count=count,
        overdue_count=overdue_count,
        expected_inflow=round(expected_inflow, 2),
        expected_outflow=round(expected_outflow, 2),
        net_total=round(expected_inflow - expected_outflow, 2),
    )
    return response
