"""Persistence for the actuals engine: Customer Master, GST config,
fixed expenses, and variable expenses.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, Float, Integer, MetaData, String, Table, Text, delete, insert, select, update
from sqlalchemy.engine import Engine

from app.actuals import (
    Customer,
    CustomerInput,
    FixedExpense,
    FixedExpenseInput,
    GSTConfig,
    GSTConfigInput,
    Supplier,
    SupplierInput,
    VariableExpense,
    VariableExpenseInput,
)

_metadata = MetaData()

_customers = Table(
    "customers",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("name", String(200), nullable=False),
    Column("credit_period_days", Integer, nullable=False, default=30),
    Column("credit_buffer_type", String(16), nullable=False, default="days"),
    Column("credit_buffer_value", Float, nullable=False, default=7.0),
    Column("opening_balance", Float, nullable=False, default=0.0),
    Column("category", String(60), nullable=True),
    Column("notes", String(500), nullable=True),
    Column("active", Integer, nullable=False, default=1),
    Column("created_at", String(40), nullable=False),
)

_suppliers = Table(
    "suppliers",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("name", String(200), nullable=False),
    Column("payment_terms_days", Integer, nullable=False, default=30),
    Column("payment_buffer_type", String(16), nullable=False, default="days"),
    Column("payment_buffer_value", Float, nullable=False, default=5.0),
    Column("opening_balance", Float, nullable=False, default=0.0),
    Column("category", String(60), nullable=True),
    Column("notes", String(500), nullable=True),
    Column("active", Integer, nullable=False, default=1),
    Column("created_at", String(40), nullable=False),
)

_gst_configs = Table(
    "gst_configs",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("frequency", String(16), nullable=False, default="monthly"),
    Column("payment_day", Integer, nullable=False, default=20),
    Column("rate_pct", Float, nullable=False, default=18.0),
    Column("active", Integer, nullable=False, default=1),
    Column("created_at", String(40), nullable=False),
)

_fixed_expenses = Table(
    "fixed_expenses",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("name", String(120), nullable=False),
    Column("amount", Float, nullable=False),
    Column("frequency", String(16), nullable=False),
    Column("last_payment_date", String(20), nullable=False),
    Column("category", String(60), nullable=True),
    Column("active", Integer, nullable=False, default=1),
    Column("created_at", String(40), nullable=False),
)

_variable_expenses = Table(
    "variable_expenses",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("description", String(200), nullable=False),
    Column("amount", Float, nullable=False),
    Column("expected_date", String(20), nullable=False),
    Column("category", String(60), nullable=True),
    Column("created_at", String(40), nullable=False),
)


def _uid() -> str:
    return uuid.uuid4().hex


def _now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def init_actuals_tables(engine: Engine) -> None:
    """Create actuals tables (idempotent)."""
    _metadata.create_all(engine)


# ─── Customer CRUD ──────────────────────────────────────────────────────────


def create_customer(engine: Engine, user_id: str, inp: CustomerInput) -> Customer:
    row = {
        "id": _uid(),
        "user_id": user_id,
        "name": inp.name,
        "credit_period_days": inp.credit_period_days,
        "credit_buffer_type": inp.credit_buffer_type.value,
        "credit_buffer_value": inp.credit_buffer_value,
        "opening_balance": inp.opening_balance,
        "category": inp.category,
        "notes": inp.notes,
        "active": 1 if inp.active else 0,
        "created_at": _now(),
    }
    with engine.begin() as conn:
        conn.execute(insert(_customers).values(row))
    return Customer(
        id=row["id"],
        created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
        **inp.model_dump(),
    )


def list_customers(engine: Engine, user_id: str) -> list[Customer]:
    with engine.begin() as conn:
        rows = conn.execute(
            select(_customers).where(_customers.c.user_id == user_id)
        ).mappings().all()
    return [
        Customer(
            id=r["id"],
            name=r["name"],
            credit_period_days=r["credit_period_days"],
            credit_buffer_type=r["credit_buffer_type"],
            credit_buffer_value=r["credit_buffer_value"],
            opening_balance=r["opening_balance"],
            category=r["category"],
            notes=r["notes"],
            active=bool(r["active"]),
            created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
        )
        for r in rows
    ]


def update_customer(engine: Engine, user_id: str, customer_id: str, inp: CustomerInput) -> Customer | None:
    with engine.begin() as conn:
        result = conn.execute(
            update(_customers)
            .where(_customers.c.id == customer_id, _customers.c.user_id == user_id)
            .values(
                name=inp.name,
                credit_period_days=inp.credit_period_days,
                credit_buffer_type=inp.credit_buffer_type.value,
                credit_buffer_value=inp.credit_buffer_value,
                opening_balance=inp.opening_balance,
                category=inp.category,
                notes=inp.notes,
                active=1 if inp.active else 0,
            )
        )
        if result.rowcount == 0:
            return None
    customers = list_customers(engine, user_id)
    return next((c for c in customers if c.id == customer_id), None)


def delete_customer(engine: Engine, user_id: str, customer_id: str) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            delete(_customers).where(_customers.c.id == customer_id, _customers.c.user_id == user_id)
        )
    return result.rowcount > 0


# ─── Supplier CRUD ──────────────────────────────────────────────────────────


def create_supplier(engine: Engine, user_id: str, inp: SupplierInput) -> Supplier:
    row = {
        "id": _uid(),
        "user_id": user_id,
        "name": inp.name,
        "payment_terms_days": inp.payment_terms_days,
        "payment_buffer_type": inp.payment_buffer_type.value,
        "payment_buffer_value": inp.payment_buffer_value,
        "opening_balance": inp.opening_balance,
        "category": inp.category,
        "notes": inp.notes,
        "active": 1 if inp.active else 0,
        "created_at": _now(),
    }
    with engine.begin() as conn:
        conn.execute(insert(_suppliers).values(row))
    return Supplier(
        id=row["id"],
        created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
        **inp.model_dump(),
    )


def list_suppliers(engine: Engine, user_id: str) -> list[Supplier]:
    with engine.begin() as conn:
        rows = conn.execute(
            select(_suppliers).where(_suppliers.c.user_id == user_id)
        ).mappings().all()
    return [
        Supplier(
            id=r["id"],
            name=r["name"],
            payment_terms_days=r["payment_terms_days"],
            payment_buffer_type=r["payment_buffer_type"],
            payment_buffer_value=r["payment_buffer_value"],
            opening_balance=r["opening_balance"],
            category=r["category"],
            notes=r["notes"],
            active=bool(r["active"]),
            created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
        )
        for r in rows
    ]


def update_supplier(engine: Engine, user_id: str, supplier_id: str, inp: SupplierInput) -> Supplier | None:
    with engine.begin() as conn:
        result = conn.execute(
            update(_suppliers)
            .where(_suppliers.c.id == supplier_id, _suppliers.c.user_id == user_id)
            .values(
                name=inp.name,
                payment_terms_days=inp.payment_terms_days,
                payment_buffer_type=inp.payment_buffer_type.value,
                payment_buffer_value=inp.payment_buffer_value,
                opening_balance=inp.opening_balance,
                category=inp.category,
                notes=inp.notes,
                active=1 if inp.active else 0,
            )
        )
        if result.rowcount == 0:
            return None
    suppliers = list_suppliers(engine, user_id)
    return next((s for s in suppliers if s.id == supplier_id), None)


def delete_supplier(engine: Engine, user_id: str, supplier_id: str) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            delete(_suppliers).where(_suppliers.c.id == supplier_id, _suppliers.c.user_id == user_id)
        )
    return result.rowcount > 0


# ─── GST Config CRUD ────────────────────────────────────────────────────────


def save_gst_config(engine: Engine, user_id: str, inp: GSTConfigInput) -> GSTConfig:
    """Upsert GST config — one per user."""
    now = _now()
    with engine.begin() as conn:
        existing = conn.execute(
            select(_gst_configs).where(_gst_configs.c.user_id == user_id)
        ).mappings().first()
        if existing:
            conn.execute(
                update(_gst_configs)
                .where(_gst_configs.c.user_id == user_id)
                .values(
                    frequency=inp.frequency.value,
                    payment_day=inp.payment_day,
                    rate_pct=inp.rate_pct,
                    active=1 if inp.active else 0,
                )
            )
            gst_id = existing["id"]
            created = existing["created_at"]
        else:
            gst_id = _uid()
            created = now
            conn.execute(insert(_gst_configs).values(
                id=gst_id,
                user_id=user_id,
                frequency=inp.frequency.value,
                payment_day=inp.payment_day,
                rate_pct=inp.rate_pct,
                active=1 if inp.active else 0,
                created_at=created,
            ))
    return GSTConfig(
        id=gst_id,
        user_id=user_id,
        created_at=datetime.fromisoformat(created.replace("Z", "+00:00")),
        **inp.model_dump(),
    )


def get_gst_config(engine: Engine, user_id: str) -> GSTConfig | None:
    with engine.begin() as conn:
        row = conn.execute(
            select(_gst_configs).where(_gst_configs.c.user_id == user_id)
        ).mappings().first()
    if not row:
        return None
    return GSTConfig(
        id=row["id"],
        user_id=user_id,
        frequency=row["frequency"],
        payment_day=row["payment_day"],
        rate_pct=row["rate_pct"],
        active=bool(row["active"]),
        created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
    )


# ─── Fixed Expenses CRUD ────────────────────────────────────────────────────


def create_fixed_expense(engine: Engine, user_id: str, inp: FixedExpenseInput) -> FixedExpense:
    row = {
        "id": _uid(),
        "user_id": user_id,
        "name": inp.name,
        "amount": inp.amount,
        "frequency": inp.frequency.value,
        "last_payment_date": inp.last_payment_date.isoformat(),
        "category": inp.category,
        "active": 1 if inp.active else 0,
        "created_at": _now(),
    }
    with engine.begin() as conn:
        conn.execute(insert(_fixed_expenses).values(row))
    return FixedExpense(
        id=row["id"],
        user_id=user_id,
        created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
        **inp.model_dump(),
    )


def list_fixed_expenses(engine: Engine, user_id: str) -> list[FixedExpense]:
    with engine.begin() as conn:
        rows = conn.execute(
            select(_fixed_expenses).where(_fixed_expenses.c.user_id == user_id)
        ).mappings().all()
    from datetime import date as d
    return [
        FixedExpense(
            id=r["id"],
            user_id=user_id,
            name=r["name"],
            amount=r["amount"],
            frequency=r["frequency"],
            last_payment_date=d.fromisoformat(r["last_payment_date"]),
            category=r["category"],
            active=bool(r["active"]),
            created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
        )
        for r in rows
    ]


def delete_fixed_expense(engine: Engine, user_id: str, expense_id: str) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            delete(_fixed_expenses).where(
                _fixed_expenses.c.id == expense_id, _fixed_expenses.c.user_id == user_id
            )
        )
    return result.rowcount > 0


# ─── Variable Expenses CRUD ─────────────────────────────────────────────────


def create_variable_expense(engine: Engine, user_id: str, inp: VariableExpenseInput) -> VariableExpense:
    row = {
        "id": _uid(),
        "user_id": user_id,
        "description": inp.description,
        "amount": inp.amount,
        "expected_date": inp.expected_date.isoformat(),
        "category": inp.category,
        "created_at": _now(),
    }
    with engine.begin() as conn:
        conn.execute(insert(_variable_expenses).values(row))
    return VariableExpense(
        id=row["id"],
        user_id=user_id,
        created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
        **inp.model_dump(),
    )


def list_variable_expenses(engine: Engine, user_id: str) -> list[VariableExpense]:
    with engine.begin() as conn:
        rows = conn.execute(
            select(_variable_expenses).where(_variable_expenses.c.user_id == user_id)
        ).mappings().all()
    from datetime import date as d
    return [
        VariableExpense(
            id=r["id"],
            user_id=user_id,
            description=r["description"],
            amount=r["amount"],
            expected_date=d.fromisoformat(r["expected_date"]),
            category=r["category"],
            created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
        )
        for r in rows
    ]


def delete_variable_expense(engine: Engine, user_id: str, expense_id: str) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            delete(_variable_expenses).where(
                _variable_expenses.c.id == expense_id, _variable_expenses.c.user_id == user_id
            )
        )
    return result.rowcount > 0
