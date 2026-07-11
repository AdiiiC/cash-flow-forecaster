"""API routes for the deterministic actuals engine (Phase 1).

Provides CRUD for Customer Master, GST config, Fixed/Variable Expenses,
and the deterministic projection endpoint.
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.actuals import (
    Customer,
    CustomerInput,
    DeterministicProjection,
    FixedExpense,
    FixedExpenseInput,
    GSTConfig,
    GSTConfigInput,
    Supplier,
    SupplierInput,
    VariableExpense,
    VariableExpenseInput,
)
from app.actuals.engine import build_deterministic_projection
from app.actuals.store import (
    create_customer,
    create_fixed_expense,
    create_supplier,
    create_variable_expense,
    delete_customer,
    delete_fixed_expense,
    delete_supplier,
    delete_variable_expense,
    get_gst_config,
    init_actuals_tables,
    list_customers,
    list_fixed_expenses,
    list_suppliers,
    list_variable_expenses,
    save_gst_config,
    update_customer,
    update_supplier,
)
from app.auth import get_current_user, get_current_user_optional
from app.data.ingest import IngestError, parse_csv
from app.store import _engine

router = APIRouter(prefix="/actuals", tags=["actuals"])


def _get_engine():
    """Get the database engine and ensure actuals tables exist."""
    engine = _engine()
    init_actuals_tables(engine)
    return engine


def _require_user(user: dict | None) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to use this feature.")
    return user


# ─── Customer Master ────────────────────────────────────────────────────────


@router.post("/customers", response_model=Customer, status_code=201)
def create_customer_route(
    inp: CustomerInput,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return create_customer(engine, u["id"], inp)


@router.get("/customers", response_model=list[Customer])
def list_customers_route(
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return list_customers(engine, u["id"])


@router.put("/customers/{customer_id}", response_model=Customer)
def update_customer_route(
    customer_id: str,
    inp: CustomerInput,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    result = update_customer(engine, u["id"], customer_id, inp)
    if result is None:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return result


@router.delete("/customers/{customer_id}", status_code=204)
def delete_customer_route(
    customer_id: str,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    if not delete_customer(engine, u["id"], customer_id):
        raise HTTPException(status_code=404, detail="Customer not found.")


# ─── Supplier Master ────────────────────────────────────────────────────────


@router.post("/suppliers", response_model=Supplier, status_code=201)
def create_supplier_route(
    inp: SupplierInput,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return create_supplier(engine, u["id"], inp)


@router.get("/suppliers", response_model=list[Supplier])
def list_suppliers_route(
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return list_suppliers(engine, u["id"])


@router.put("/suppliers/{supplier_id}", response_model=Supplier)
def update_supplier_route(
    supplier_id: str,
    inp: SupplierInput,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    result = update_supplier(engine, u["id"], supplier_id, inp)
    if result is None:
        raise HTTPException(status_code=404, detail="Supplier not found.")
    return result


@router.delete("/suppliers/{supplier_id}", status_code=204)
def delete_supplier_route(
    supplier_id: str,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    if not delete_supplier(engine, u["id"], supplier_id):
        raise HTTPException(status_code=404, detail="Supplier not found.")


# ─── GST Config ─────────────────────────────────────────────────────────────


@router.put("/gst", response_model=GSTConfig)
def save_gst_config_route(
    inp: GSTConfigInput,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return save_gst_config(engine, u["id"], inp)


@router.get("/gst")
def get_gst_config_route(
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return get_gst_config(engine, u["id"])


# ─── Fixed Expenses ─────────────────────────────────────────────────────────


@router.post("/expenses/fixed", response_model=FixedExpense, status_code=201)
def create_fixed_expense_route(
    inp: FixedExpenseInput,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return create_fixed_expense(engine, u["id"], inp)


@router.get("/expenses/fixed", response_model=list[FixedExpense])
def list_fixed_expenses_route(
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return list_fixed_expenses(engine, u["id"])


@router.delete("/expenses/fixed/{expense_id}", status_code=204)
def delete_fixed_expense_route(
    expense_id: str,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    if not delete_fixed_expense(engine, u["id"], expense_id):
        raise HTTPException(status_code=404, detail="Expense not found.")


# ─── Variable Expenses ──────────────────────────────────────────────────────


@router.post("/expenses/variable", response_model=VariableExpense, status_code=201)
def create_variable_expense_route(
    inp: VariableExpenseInput,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return create_variable_expense(engine, u["id"], inp)


@router.get("/expenses/variable", response_model=list[VariableExpense])
def list_variable_expenses_route(
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    return list_variable_expenses(engine, u["id"])


@router.delete("/expenses/variable/{expense_id}", status_code=204)
def delete_variable_expense_route(
    expense_id: str,
    user: dict | None = Depends(get_current_user_optional),
):
    u = _require_user(user)
    engine = _get_engine()
    if not delete_variable_expense(engine, u["id"], expense_id):
        raise HTTPException(status_code=404, detail="Expense not found.")


# ─── Deterministic Projection ───────────────────────────────────────────────


@router.post("/project", response_model=DeterministicProjection)
async def run_projection(
    file: UploadFile = File(...),
    opening_balance: float = Query(0.0),
    currency: str = Query("INR"),
    horizon_weeks: int = Query(13, ge=4, le=104),
    default_buffer_days: int = Query(7, ge=0, le=90),
    granularity: str = Query("daily", pattern="^(daily|weekly)$"),
    user: dict | None = Depends(get_current_user_optional),
):
    """Upload a CSV of actual transactions and run the deterministic projection.
    
    Uses the user's configured Customer Master (credit terms + buffer),
    fixed expenses, variable expenses, and GST config to schedule all cash
    events and roll the balance forward.
    """
    u = _require_user(user)
    engine = _get_engine()

    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")

    max_bytes = 5 * 1024 * 1024
    raw = await file.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large: max 5 MB.")

    try:
        ledger = parse_csv(raw, opening_balance=opening_balance, currency=currency)
    except IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Load user's config
    customers = list_customers(engine, u["id"])
    suppliers = list_suppliers(engine, u["id"])
    fixed = list_fixed_expenses(engine, u["id"])
    variable = list_variable_expenses(engine, u["id"])
    gst = get_gst_config(engine, u["id"])

    from app import store as _main_store
    exim = _main_store.list_exim(u["id"], open_only=True)

    projection = build_deterministic_projection(
        entries=ledger.entries,
        customers=customers,
        suppliers=suppliers,
        fixed_expenses=fixed,
        variable_expenses=variable,
        gst_config=gst,
        opening_balance=opening_balance,
        currency=currency,
        horizon_weeks=horizon_weeks,
        default_buffer_days=default_buffer_days,
        granularity=granularity,
        exim_invoices=exim,
    )

    return projection


@router.post("/project/demo", response_model=DeterministicProjection)
def run_demo_projection(
    opening_balance: float = Query(20_000_000.0),
    currency: str = Query("INR"),
    horizon_weeks: int = Query(13, ge=4, le=104),
    granularity: str = Query("daily", pattern="^(daily|weekly)$"),
):
    """Run a deterministic projection with sample data (no auth required).
    
    Generates realistic sample transactions so visitors can see the engine
    in action without uploading their own data.
    """
    from app.actuals.sample_data import generate_sample_data

    entries, customers, suppliers, fixed_expenses, variable_expenses, gst_config = generate_sample_data()

    projection = build_deterministic_projection(
        entries=entries,
        customers=customers,
        suppliers=suppliers,
        fixed_expenses=fixed_expenses,
        variable_expenses=variable_expenses,
        gst_config=gst_config,
        opening_balance=opening_balance,
        currency=currency,
        horizon_weeks=horizon_weeks,
        default_buffer_days=7,
        granularity=granularity,
    )

    return projection
