"""Deterministic cash-flow scheduling engine (Phase 1).

Takes actual sales/purchase data + customer credit terms + buffer + expenses
+ GST config and produces a period-by-period (weekly) cash balance projection.
No ML, no prediction — just scheduling known amounts to expected dates.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Sequence

from app.actuals import (
    CashEvent,
    CreditBufferType,
    Customer,
    DeterministicProjection,
    FixedExpense,
    GSTConfig,
    PaymentBufferType,
    ProjectionPeriod,
    Supplier,
    VariableExpense,
)
from app.schemas import Direction, LedgerEntry


def _next_occurrence(last: date, frequency: str) -> date:
    """Compute the next payment date from the last one + frequency."""
    if frequency == "weekly":
        return last + timedelta(weeks=1)
    elif frequency == "biweekly":
        return last + timedelta(weeks=2)
    elif frequency == "monthly":
        month = last.month % 12 + 1
        year = last.year + (1 if last.month == 12 else 0)
        day = min(last.day, 28)
        return date(year, month, day)
    elif frequency == "quarterly":
        month = last.month + 3
        year = last.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        day = min(last.day, 28)
        return date(year, month, day)
    elif frequency == "yearly":
        return date(last.year + 1, last.month, min(last.day, 28))
    return last + timedelta(days=30)


def _generate_expense_occurrences(
    expense: FixedExpense, start: date, end: date
) -> list[CashEvent]:
    """Generate all future occurrences of a fixed expense within [start, end]."""
    events: list[CashEvent] = []
    if not expense.active:
        return events
    current = _next_occurrence(expense.last_payment_date, expense.frequency.value)
    while current <= end:
        if current >= start:
            events.append(CashEvent(
                date=current,
                amount=expense.amount,
                direction="outflow",
                source="fixed_expense",
                label=expense.name,
            ))
        current = _next_occurrence(current, expense.frequency.value)
    return events


def _generate_gst_payments(
    gst: GSTConfig | None,
    total_inflows: float,
    start: date,
    end: date,
) -> list[CashEvent]:
    """Schedule GST payments based on config and total taxable inflows."""
    if not gst or not gst.active or gst.rate_pct <= 0:
        return []

    events: list[CashEvent] = []
    # Calculate total months in the window
    current = date(start.year, start.month, gst.payment_day)
    if current < start:
        # Move to next month
        month = start.month % 12 + 1
        year = start.year + (1 if start.month == 12 else 0)
        current = date(year, month, min(gst.payment_day, 28))

    # Estimate per-period GST liability (simplified: spread evenly)
    if gst.frequency.value == "monthly":
        step_months = 1
    else:  # quarterly
        step_months = 3

    # Count payment dates in window
    payment_dates: list[date] = []
    d = current
    while d <= end:
        payment_dates.append(d)
        month = d.month + step_months
        year = d.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        d = date(year, month, min(gst.payment_day, 28))

    if not payment_dates:
        return []

    # Spread total GST liability across payment dates
    total_gst = total_inflows * (gst.rate_pct / 100.0)
    per_payment = total_gst / len(payment_dates) if payment_dates else 0.0

    for pd in payment_dates:
        events.append(CashEvent(
            date=pd,
            amount=round(per_payment, 2),
            direction="outflow",
            source="gst",
            label=f"GST payment ({gst.frequency.value})",
        ))

    return events


def _apply_credit_buffer(
    due_date: date,
    customer: Customer | None,
    default_buffer_days: int = 7,
) -> tuple[date, float]:
    """Apply credit buffer to a due date. Returns (collection_date, collection_fraction).
    
    For type=days: shifts the date; fraction=1.0.
    For type=percent: same date; fraction = buffer_value / 100 (rest slips).
    """
    if customer is None:
        return (due_date + timedelta(days=default_buffer_days), 1.0)

    if customer.credit_buffer_type == CreditBufferType.days:
        buffer_days = int(customer.credit_buffer_value)
        return (due_date + timedelta(days=buffer_days), 1.0)
    else:  # percent
        fraction = customer.credit_buffer_value / 100.0
        return (due_date, fraction)


def schedule_inflows(
    entries: list[LedgerEntry],
    customers: list[Customer],
    start: date,
    end: date,
    default_buffer_days: int = 7,
) -> list[CashEvent]:
    """Schedule cash inflows from outstanding receivables + customer opening balances,
    applying credit terms + buffer."""
    customer_map = {c.name.lower(): c for c in customers}
    events: list[CashEvent] = []

    # Schedule customer opening balances (outstanding AR per customer) as immediate inflows.
    # These are amounts already owed — schedule collection at start + credit buffer.
    for customer in customers:
        if not customer.active or customer.opening_balance <= 0:
            continue
        due_date = start  # already past due (owed now)
        collection_date, fraction = _apply_credit_buffer(due_date, customer, default_buffer_days)
        if collection_date <= end:
            events.append(CashEvent(
                date=collection_date,
                amount=round(customer.opening_balance * fraction, 2),
                direction="inflow",
                source="opening_balance",
                label=f"Opening AR - {customer.name}",
            ))
            if fraction < 1.0:
                slip_date = collection_date + timedelta(days=14)
                if slip_date <= end:
                    events.append(CashEvent(
                        date=slip_date,
                        amount=round(customer.opening_balance * (1 - fraction), 2),
                        direction="inflow",
                        source="opening_balance",
                        label=f"Late opening AR - {customer.name}",
                    ))

    for entry in entries:
        if entry.direction != Direction.inflow:
            continue

        # Paid entries are already realized cash — schedule on their date.
        if entry.status.value == "paid":
            if start <= entry.date <= end:
                events.append(CashEvent(
                    date=entry.date,
                    amount=entry.amount,
                    direction="inflow",
                    source="sales",
                    label=f"Sales - {entry.category}" + (f" ({entry.customer_id})" if entry.customer_id else ""),
                ))
            continue

        # Outstanding: apply credit period + buffer.
        customer = customer_map.get((entry.customer_id or "").lower())
        credit_days = customer.credit_period_days if customer else 30
        due_date = entry.date + timedelta(days=credit_days)
        collection_date, fraction = _apply_credit_buffer(due_date, customer, default_buffer_days)

        if start <= collection_date <= end:
            events.append(CashEvent(
                date=collection_date,
                amount=round(entry.amount * fraction, 2),
                direction="inflow",
                source="sales",
                label=f"Receivable - {entry.category}" + (f" ({entry.customer_id})" if entry.customer_id else ""),
            ))
            # If percent buffer, schedule the remainder 14 days later (simplified slip model).
            if fraction < 1.0:
                slip_date = collection_date + timedelta(days=14)
                if slip_date <= end:
                    events.append(CashEvent(
                        date=slip_date,
                        amount=round(entry.amount * (1 - fraction), 2),
                        direction="inflow",
                        source="sales",
                        label=f"Late receivable - {entry.category}" + (f" ({entry.customer_id})" if entry.customer_id else ""),
                    ))

    return events


def _apply_payment_buffer(
    due_date: date,
    supplier: Supplier | None,
    default_buffer_days: int = 5,
) -> tuple[date, float]:
    """Apply payment buffer to a supplier bill due date.
    
    For type=days: shifts the payment date; fraction=1.0.
    For type=percent: same date; fraction = buffer_value / 100 (rest slips later).
    """
    if supplier is None:
        return (due_date + timedelta(days=default_buffer_days), 1.0)

    if supplier.payment_buffer_type == PaymentBufferType.days:
        buffer_days = int(supplier.payment_buffer_value)
        return (due_date + timedelta(days=buffer_days), 1.0)
    else:  # percent
        fraction = supplier.payment_buffer_value / 100.0
        return (due_date, fraction)


def schedule_outflows(
    entries: list[LedgerEntry],
    suppliers: list[Supplier],
    start: date,
    end: date,
    default_buffer_days: int = 5,
) -> list[CashEvent]:
    """Schedule cash outflows from purchase bills, payables, and supplier opening balances,
    applying supplier payment terms + buffer."""
    supplier_map = {s.name.lower(): s for s in suppliers}
    events: list[CashEvent] = []

    # Schedule supplier opening balances (outstanding AP per supplier) as immediate outflows.
    # These are amounts you already owe — schedule payment at start + payment buffer.
    for supplier in suppliers:
        if not supplier.active or supplier.opening_balance <= 0:
            continue
        due_date = start  # already owed
        payment_date, fraction = _apply_payment_buffer(due_date, supplier, default_buffer_days)
        if payment_date <= end:
            events.append(CashEvent(
                date=payment_date,
                amount=round(supplier.opening_balance * fraction, 2),
                direction="outflow",
                source="opening_balance",
                label=f"Opening AP - {supplier.name}",
            ))
            if fraction < 1.0:
                slip_date = payment_date + timedelta(days=14)
                if slip_date <= end:
                    events.append(CashEvent(
                        date=slip_date,
                        amount=round(supplier.opening_balance * (1 - fraction), 2),
                        direction="outflow",
                        source="opening_balance",
                        label=f"Late opening AP - {supplier.name}",
                    ))

    for entry in entries:
        if entry.direction != Direction.outflow:
            continue

        # Paid entries are already realized — schedule on their date.
        if entry.status.value == "paid":
            if start <= entry.date <= end:
                events.append(CashEvent(
                    date=entry.date,
                    amount=entry.amount,
                    direction="outflow",
                    source="purchase",
                    label=f"Purchase - {entry.category}" + (f" ({entry.customer_id})" if entry.customer_id else ""),
                ))
            continue

        # Outstanding payable: apply supplier payment terms + buffer.
        supplier = supplier_map.get((entry.customer_id or "").lower())
        payment_days = supplier.payment_terms_days if supplier else 30
        due_date = entry.date + timedelta(days=payment_days)
        payment_date, fraction = _apply_payment_buffer(due_date, supplier, default_buffer_days)

        if start <= payment_date <= end:
            events.append(CashEvent(
                date=payment_date,
                amount=round(entry.amount * fraction, 2),
                direction="outflow",
                source="purchase",
                label=f"Payable - {entry.category}" + (f" ({entry.customer_id})" if entry.customer_id else ""),
            ))
            # If percent buffer, schedule the remainder 14 days later.
            if fraction < 1.0:
                slip_date = payment_date + timedelta(days=14)
                if slip_date <= end:
                    events.append(CashEvent(
                        date=slip_date,
                        amount=round(entry.amount * (1 - fraction), 2),
                        direction="outflow",
                        source="purchase",
                        label=f"Late payable - {entry.category}" + (f" ({entry.customer_id})" if entry.customer_id else ""),
                    ))

    return events


def build_deterministic_projection(
    entries: list[LedgerEntry],
    customers: list[Customer],
    suppliers: list[Supplier],
    fixed_expenses: list[FixedExpense],
    variable_expenses: list[VariableExpense],
    gst_config: GSTConfig | None,
    opening_balance: float,
    currency: str = "INR",
    horizon_weeks: int = 13,
    default_buffer_days: int = 7,
) -> DeterministicProjection:
    """Run the full deterministic scheduling engine and produce a projection.
    
    Steps:
    1. Schedule inflows (actual sales + outstanding with credit buffer applied).
    2. Schedule outflows (purchases + payables with supplier payment terms + buffer).
    3. Auto-schedule fixed expenses (from frequency + last payment date).
    4. Place variable expenses on their expected dates.
    5. Schedule GST payments.
    6. Roll forward balance period by period (weekly).
    """
    today = date.today()
    start = today
    end = today + timedelta(weeks=horizon_weeks)

    # 1. Schedule inflows
    inflow_events = schedule_inflows(entries, customers, start, end, default_buffer_days)

    # 2. Schedule outflows (purchases with supplier terms + buffer)
    outflow_events = schedule_outflows(entries, suppliers, start, end, default_buffer_days)

    # 3. Fixed expenses
    fixed_events: list[CashEvent] = []
    for fe in fixed_expenses:
        fixed_events.extend(_generate_expense_occurrences(fe, start, end))

    # 4. Variable expenses
    var_events: list[CashEvent] = []
    for ve in variable_expenses:
        if start <= ve.expected_date <= end:
            var_events.append(CashEvent(
                date=ve.expected_date,
                amount=ve.amount,
                direction="outflow",
                source="variable_expense",
                label=ve.description,
            ))

    # 5. GST (needs total taxable inflows first)
    total_taxable_inflows = sum(e.amount for e in inflow_events)
    gst_events = _generate_gst_payments(gst_config, total_taxable_inflows, start, end)

    # Combine all events
    all_events = inflow_events + outflow_events + fixed_events + var_events + gst_events
    all_events.sort(key=lambda e: e.date)

    # 6. Roll forward: build weekly periods
    periods: list[ProjectionPeriod] = []
    balance = opening_balance
    runway_weeks: int | None = None
    trough_balance = opening_balance
    trough_date: date | None = None

    total_in = 0.0
    total_out = 0.0
    inflow_summary: dict[str, float] = {}
    outflow_summary: dict[str, float] = {}

    for week_idx in range(horizon_weeks):
        period_start = start + timedelta(weeks=week_idx)
        period_end = period_start + timedelta(days=6)

        week_events = [e for e in all_events if period_start <= e.date <= period_end]
        week_in = sum(e.amount for e in week_events if e.direction == "inflow")
        week_out = sum(e.amount for e in week_events if e.direction == "outflow")
        net = week_in - week_out
        balance += net
        total_in += week_in
        total_out += week_out

        # Track source breakdowns
        for e in week_events:
            if e.direction == "inflow":
                inflow_summary[e.source] = inflow_summary.get(e.source, 0.0) + e.amount
            else:
                outflow_summary[e.source] = outflow_summary.get(e.source, 0.0) + e.amount

        if balance < trough_balance:
            trough_balance = balance
            trough_date = period_end

        if balance < 0 and runway_weeks is None:
            runway_weeks = week_idx

        periods.append(ProjectionPeriod(
            period_start=period_start,
            period_end=period_end,
            inflows=round(week_in, 2),
            outflows=round(week_out, 2),
            net=round(net, 2),
            closing_balance=round(balance, 2),
            events=week_events,
        ))

    return DeterministicProjection(
        generated_at=datetime.utcnow(),
        currency=currency,
        opening_balance=opening_balance,
        closing_balance=round(balance, 2),
        total_inflows=round(total_in, 2),
        total_outflows=round(total_out, 2),
        net_cash_flow=round(total_in - total_out, 2),
        runway_weeks=runway_weeks,
        trough_balance=round(trough_balance, 2),
        trough_date=trough_date,
        periods=periods,
        gst_total=round(sum(e.amount for e in gst_events), 2),
        inflow_summary=inflow_summary,
        outflow_summary=outflow_summary,
    )
