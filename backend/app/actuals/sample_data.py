"""Generate realistic sample data for the deterministic projection demo.

This produces a set of transactions, customers, fixed expenses, variable
expenses, and GST config that an Indian SaaS/services business might have
— so the dashboard is immediately interesting without real data.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
import random

from app.actuals import (
    CreditBufferType,
    Customer,
    ExpenseFrequency,
    FixedExpense,
    GSTConfig,
    GSTFrequency,
    VariableExpense,
)
from app.schemas import Direction, EntryStatus, LedgerEntry


def generate_sample_data(
    seed: int = 42,
) -> tuple[
    list[LedgerEntry],
    list[Customer],
    list[FixedExpense],
    list[VariableExpense],
    GSTConfig,
]:
    """Return (entries, customers, fixed_expenses, variable_expenses, gst_config)."""
    rng = random.Random(seed)
    today = date.today()

    # ── Customers with varied credit terms ───────────────────────────────
    customers = [
        Customer(
            id="cust_001",
            name="Acme Corp",
            credit_period_days=30,
            credit_buffer_type=CreditBufferType.days,
            credit_buffer_value=7,
            category="enterprise",
            notes=None,
            active=True,
            created_at=datetime(2024, 1, 1),
        ),
        Customer(
            id="cust_002",
            name="Globex Industries",
            credit_period_days=45,
            credit_buffer_type=CreditBufferType.days,
            credit_buffer_value=10,
            category="enterprise",
            notes=None,
            active=True,
            created_at=datetime(2024, 2, 15),
        ),
        Customer(
            id="cust_003",
            name="Initech Solutions",
            credit_period_days=15,
            credit_buffer_type=CreditBufferType.percent,
            credit_buffer_value=85,  # 85% collects on time
            category="sme",
            notes=None,
            active=True,
            created_at=datetime(2024, 3, 1),
        ),
        Customer(
            id="cust_004",
            name="Stark Enterprises",
            credit_period_days=60,
            credit_buffer_type=CreditBufferType.days,
            credit_buffer_value=14,
            category="enterprise",
            notes=None,
            active=True,
            created_at=datetime(2024, 4, 1),
        ),
        Customer(
            id="cust_005",
            name="Wayne Industries",
            credit_period_days=30,
            credit_buffer_type=CreditBufferType.days,
            credit_buffer_value=5,
            category="enterprise",
            notes=None,
            active=True,
            created_at=datetime(2024, 5, 1),
        ),
    ]

    # ── Historical + outstanding sales (past 8 weeks + future outstanding) ──
    entries: list[LedgerEntry] = []
    customer_names = [c.name for c in customers]

    # Historical paid sales
    for weeks_ago in range(8, 0, -1):
        d = today - timedelta(weeks=weeks_ago)
        num_invoices = rng.randint(2, 4)
        for _ in range(num_invoices):
            entries.append(LedgerEntry(
                date=d + timedelta(days=rng.randint(0, 6)),
                amount=rng.randint(200_000, 1_500_000),
                direction=Direction.inflow,
                category=rng.choice(["software_services", "consulting", "subscriptions"]),
                customer_id=rng.choice(customer_names),
                status=EntryStatus.paid,
            ))

    # Outstanding receivables (invoiced in the last 2-6 weeks, not yet paid)
    for i in range(6):
        weeks_ago = rng.randint(1, 6)
        entries.append(LedgerEntry(
            date=today - timedelta(weeks=weeks_ago, days=rng.randint(0, 4)),
            amount=rng.randint(400_000, 2_000_000),
            direction=Direction.inflow,
            category=rng.choice(["software_services", "consulting", "subscriptions"]),
            customer_id=rng.choice(customer_names),
            status=EntryStatus.outstanding,
        ))

    # Historical purchases/bills
    for weeks_ago in range(8, 0, -1):
        d = today - timedelta(weeks=weeks_ago)
        entries.append(LedgerEntry(
            date=d + timedelta(days=rng.randint(0, 4)),
            amount=rng.randint(100_000, 600_000),
            direction=Direction.outflow,
            category=rng.choice(["cloud_infra", "marketing", "office", "travel"]),
            customer_id=None,
            status=EntryStatus.paid,
        ))

    # Upcoming purchase commitments (outstanding payables)
    for i in range(3):
        entries.append(LedgerEntry(
            date=today + timedelta(days=rng.randint(7, 30)),
            amount=rng.randint(200_000, 800_000),
            direction=Direction.outflow,
            category=rng.choice(["cloud_infra", "vendor_payment", "equipment"]),
            customer_id=None,
            status=EntryStatus.outstanding,
        ))

    # ── Fixed / Recurring Expenses ───────────────────────────────────────
    now = datetime.utcnow()
    fixed_expenses = [
        FixedExpense(
            id="fe_001",
            user_id="demo",
            name="Salaries & benefits",
            amount=3_500_000,
            frequency=ExpenseFrequency.monthly,
            last_payment_date=today - timedelta(days=15),
            category="payroll",
            active=True,
            created_at=now,
        ),
        FixedExpense(
            id="fe_002",
            user_id="demo",
            name="Office rent",
            amount=450_000,
            frequency=ExpenseFrequency.monthly,
            last_payment_date=today - timedelta(days=5),
            category="office",
            active=True,
            created_at=now,
        ),
        FixedExpense(
            id="fe_003",
            user_id="demo",
            name="Cloud & SaaS subscriptions",
            amount=280_000,
            frequency=ExpenseFrequency.monthly,
            last_payment_date=today - timedelta(days=10),
            category="cloud_infra",
            active=True,
            created_at=now,
        ),
        FixedExpense(
            id="fe_004",
            user_id="demo",
            name="Insurance premium",
            amount=120_000,
            frequency=ExpenseFrequency.quarterly,
            last_payment_date=today - timedelta(days=60),
            category="insurance",
            active=True,
            created_at=now,
        ),
    ]

    # ── Variable / One-off Expenses ──────────────────────────────────────
    variable_expenses = [
        VariableExpense(
            id="ve_001",
            user_id="demo",
            description="Annual conference sponsorship",
            amount=500_000,
            expected_date=today + timedelta(days=30),
            category="marketing",
            created_at=now,
        ),
        VariableExpense(
            id="ve_002",
            user_id="demo",
            description="Server migration (one-time)",
            amount=350_000,
            expected_date=today + timedelta(days=45),
            category="cloud_infra",
            created_at=now,
        ),
    ]

    # ── GST Config ───────────────────────────────────────────────────────
    gst_config = GSTConfig(
        id="gst_demo",
        user_id="demo",
        frequency=GSTFrequency.monthly,
        payment_day=20,
        rate_pct=18.0,
        active=True,
        created_at=now,
    )

    return entries, customers, fixed_expenses, variable_expenses, gst_config
