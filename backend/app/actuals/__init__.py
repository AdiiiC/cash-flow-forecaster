"""Schemas for the deterministic actuals engine (Phase 1).

These cover the Customer Master, GST configuration, fixed/variable expenses,
and the deterministic cash-flow projection output.
"""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


# ─── Customer Master ────────────────────────────────────────────────────────


class CreditBufferType(str, Enum):
    days = "days"  # shift collection date by N buffer days
    percent = "percent"  # assume X% collects on time, rest slips


class CustomerInput(BaseModel):
    """Create/update a customer in the master."""

    name: str = Field(..., min_length=1, max_length=200)
    credit_period_days: int = Field(30, ge=0, le=365, description="Net payment terms in days")
    credit_buffer_type: CreditBufferType = CreditBufferType.days
    credit_buffer_value: float = Field(
        7.0,
        ge=0,
        description="Buffer days (if type=days) or collection % (if type=percent, 0-100)",
    )
    opening_balance: float = Field(
        0.0,
        ge=0,
        description="How much this customer currently owes you (outstanding AR)",
    )
    category: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=500)
    active: bool = True

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank.")
        return v

    @field_validator("credit_buffer_value")
    @classmethod
    def _validate_buffer(cls, v: float, info) -> float:
        buf_type = info.data.get("credit_buffer_type")
        if buf_type == CreditBufferType.percent and (v < 0 or v > 100):
            raise ValueError("percent buffer must be between 0 and 100.")
        return v


class Customer(CustomerInput):
    id: str
    created_at: datetime


# ─── Supplier Master ────────────────────────────────────────────────────────


class PaymentBufferType(str, Enum):
    days = "days"  # shift payment date by N buffer days
    percent = "percent"  # assume X% paid on time, rest slips later


class SupplierInput(BaseModel):
    """Create/update a supplier in the master."""

    name: str = Field(..., min_length=1, max_length=200)
    payment_terms_days: int = Field(30, ge=0, le=365, description="Net payment terms in days")
    payment_buffer_type: PaymentBufferType = PaymentBufferType.days
    payment_buffer_value: float = Field(
        5.0,
        ge=0,
        description="Buffer days (if type=days) or on-time payment % (if type=percent, 0-100)",
    )
    opening_balance: float = Field(
        0.0,
        ge=0,
        description="How much you currently owe this supplier (outstanding AP)",
    )
    category: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=500)
    active: bool = True

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank.")
        return v

    @field_validator("payment_buffer_value")
    @classmethod
    def _validate_buffer(cls, v: float, info) -> float:
        buf_type = info.data.get("payment_buffer_type")
        if buf_type == PaymentBufferType.percent and (v < 0 or v > 100):
            raise ValueError("percent buffer must be between 0 and 100.")
        return v


class Supplier(SupplierInput):
    id: str
    created_at: datetime


# ─── GST Configuration ──────────────────────────────────────────────────────


class GSTFrequency(str, Enum):
    monthly = "monthly"
    quarterly = "quarterly"


class GSTConfigInput(BaseModel):
    """GST payment configuration — determines when GST liability hits cash."""

    frequency: GSTFrequency = GSTFrequency.monthly
    payment_day: int = Field(
        20,
        ge=1,
        le=28,
        description="Day of the month the GST payment goes out (1-28)",
    )
    rate_pct: float = Field(18.0, ge=0, le=100, description="Applicable GST rate %")
    active: bool = True


class GSTConfig(GSTConfigInput):
    id: str
    user_id: str
    created_at: datetime


# ─── Fixed / Recurring Expense (enhanced) ───────────────────────────────────


class ExpenseFrequency(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class FixedExpenseInput(BaseModel):
    """A recurring fixed expense that the system auto-schedules."""

    name: str = Field(..., min_length=1, max_length=120)
    amount: float = Field(..., gt=0)
    frequency: ExpenseFrequency
    last_payment_date: date
    category: str | None = Field(default=None, max_length=60)
    active: bool = True

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank.")
        return v


class FixedExpense(FixedExpenseInput):
    id: str
    user_id: str
    created_at: datetime


# ─── Variable / One-off Expense ─────────────────────────────────────────────


class VariableExpenseInput(BaseModel):
    """An optional one-time cash outflow."""

    description: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., gt=0)
    expected_date: date
    category: str | None = Field(default=None, max_length=60)

    @field_validator("description")
    @classmethod
    def _strip_desc(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("description must not be blank.")
        return v


class VariableExpense(VariableExpenseInput):
    id: str
    user_id: str
    created_at: datetime


# ─── Deterministic Projection Output ────────────────────────────────────────


class CashEvent(BaseModel):
    """A single scheduled cash movement in the projection."""

    date: date
    amount: float
    direction: str  # "inflow" | "outflow"
    source: str  # "sales", "purchase", "fixed_expense", "variable_expense", "gst"
    label: str  # human-readable description


class ProjectionPeriod(BaseModel):
    """A single period (week) in the deterministic projection."""

    period_start: date
    period_end: date
    inflows: float
    outflows: float
    net: float
    closing_balance: float
    events: list[CashEvent] = Field(default_factory=list)


class DeterministicProjection(BaseModel):
    """The output of the Phase 1 deterministic scheduling engine."""

    generated_at: datetime
    currency: str
    opening_balance: float
    closing_balance: float  # final period's closing balance
    total_inflows: float
    total_outflows: float
    net_cash_flow: float
    runway_weeks: int | None  # weeks until balance goes negative, None if always positive
    trough_balance: float  # lowest balance encountered
    trough_date: date | None
    periods: list[ProjectionPeriod]
    gst_total: float  # total GST outflows scheduled
    inflow_summary: dict[str, float] = Field(default_factory=dict)  # source -> total
    outflow_summary: dict[str, float] = Field(default_factory=dict)  # source -> total
