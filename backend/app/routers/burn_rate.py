"""
Burn Rate & Headcount Planning.

Tables: employees, headcount_plan
GET /api/burn-rate              — gross/net burn, burn multiple, months-to-profitability
GET /api/burn-rate/by-category  — burn split by payroll/rent/vendors/other
GET /api/headcount              — employee roster
POST /api/headcount             — add employee
PUT  /api/headcount/{id}        — update
DELETE /api/headcount/{id}      — remove
GET /api/headcount/plan         — planned hires/departures
POST /api/headcount/plan        — add planned event
DELETE /api/headcount/plan/{id} — remove planned event
"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, validator

from app import store
from app.auth import get_current_user
from app.security.crypto import decrypt, encrypt

router = APIRouter(prefix="/burn-rate", tags=["burn-rate"])
headcount_router = APIRouter(prefix="/headcount", tags=["headcount"])


# ── Burn Rate ──────────────────────────────────────────────────────────────────

@router.get("")
def burn_rate(weeks: int = 4, user: dict = Depends(get_current_user)):
    """
    Compute gross burn, net burn, burn multiple and months-to-profitability
    from the last `weeks` of actuals (or forecast if no actuals).
    """
    actuals = store.list_cashflow_actuals(user["id"])
    runs    = store.list_runs(user_id=user["id"], limit=1)
    accounts = store.list_cash_accounts(user["id"])
    customers = store.list_customers_mrr(user["id"])

    cash_on_hand = sum(
        a["balance"] for a in accounts if a["account_type"] in ("checking", "savings")
    )

    # Try actuals first
    if actuals:
        cutoff = (date.today() - timedelta(weeks=weeks)).isoformat()
        recent = [a for a in actuals if a["week_start"] >= cutoff]
        gross_burn_weekly = sum(a["amount"] for a in recent if a["direction"] == "outflow") / max(weeks, 1)
        gross_inflow_weekly = sum(a["amount"] for a in recent if a["direction"] == "inflow") / max(weeks, 1)
    elif runs:
        import json as _json
        payload = _json.loads(store.get_run(runs[0]["id"])["payload"])
        net_series = next((s for s in payload.get("series", []) if s["name"] == "net_cash_flow"), None)
        inflow_series = next((s for s in payload.get("series", []) if s["name"] == "inflow"), None)
        outflow_series = next((s for s in payload.get("series", []) if s["name"] == "outflow"), None)
        gross_burn_weekly   = abs(sum(p["p50"] for p in (outflow_series or {}).get("forecast", [])[:weeks]) / max(weeks, 1)) if outflow_series else 0
        gross_inflow_weekly = sum(p["p50"] for p in (inflow_series or {}).get("forecast", [])[:weeks]) / max(weeks, 1) if inflow_series else 0
    else:
        gross_burn_weekly = 0
        gross_inflow_weekly = 0

    net_burn_weekly = gross_burn_weekly - gross_inflow_weekly
    gross_burn_monthly = gross_burn_weekly * (52 / 12)
    net_burn_monthly   = net_burn_weekly   * (52 / 12)

    # MRR from customers
    active_mrr = sum(c.get("arr", 0) / 12 for c in customers if c.get("status") == "active")
    # Burn multiple = net burn / net new ARR (last period)
    burn_multiple = round(net_burn_monthly / active_mrr, 2) if active_mrr > 0 else None
    # Runway
    runway_months = round(cash_on_hand / max(net_burn_monthly, 1), 1) if net_burn_monthly > 0 else None
    # Months to profitability: when will inflows exceed outflows?
    months_to_profit = None
    if gross_burn_weekly > 0 and gross_inflow_weekly > 0:
        growth_needed = gross_burn_weekly - gross_inflow_weekly
        if growth_needed <= 0:
            months_to_profit = 0
        # Rough estimate assuming 5% monthly MRR growth
        elif active_mrr > 0:
            weekly_mrr = active_mrr / (52 / 12)
            months = 0
            proj_inflow = gross_inflow_weekly
            while proj_inflow < gross_burn_weekly and months < 120:
                proj_inflow *= 1.0125  # ~5% monthly
                months += 1
            months_to_profit = months

    payroll_weekly = sum(e.get("annual_salary", 0) / 52 for e in store.list_employees(user["id"]))
    recurring_weekly = sum(
        r["amount"] / (1 if r["cadence"] == "weekly" else 2 if r["cadence"] == "biweekly"
                       else 4.33 if r["cadence"] == "monthly" else 13)
        for r in store.list_recurring_items_for_user(user["id"]) if r["direction"] == "outflow"
    )

    return {
        "gross_burn_weekly":    round(gross_burn_weekly, 2),
        "gross_burn_monthly":   round(gross_burn_monthly, 2),
        "net_burn_weekly":      round(net_burn_weekly, 2),
        "net_burn_monthly":     round(net_burn_monthly, 2),
        "cash_on_hand":         round(cash_on_hand, 2),
        "runway_months":        runway_months,
        "burn_multiple":        burn_multiple,
        "months_to_profitability": months_to_profit,
        "active_mrr":           round(active_mrr, 2),
        "payroll_weekly":       round(payroll_weekly, 2),
        "recurring_weekly":     round(recurring_weekly, 2),
        "efficiency_rating": (
            "efficient"  if burn_multiple is not None and burn_multiple < 1.5
            else "moderate" if burn_multiple is not None and burn_multiple < 3
            else "high"
        ),
    }


@router.get("/by-category")
def burn_by_category(weeks: int = 4, user: dict = Depends(get_current_user)):
    actuals = store.list_cashflow_actuals(user["id"])
    cutoff  = (date.today() - timedelta(weeks=weeks)).isoformat()
    recent  = [a for a in actuals if a["week_start"] >= cutoff and a["direction"] == "outflow"]

    by_cat: dict[str, float] = {}
    for a in recent:
        cat = a.get("category", "Other") or "Other"
        by_cat[cat] = by_cat.get(cat, 0) + a["amount"]

    total = sum(by_cat.values())
    rows = sorted(
        [{"category": k, "total": round(v, 2), "weekly_avg": round(v / max(weeks, 1), 2),
          "pct": round(v / total * 100, 1) if total else 0}
         for k, v in by_cat.items()],
        key=lambda r: r["total"], reverse=True,
    )
    return {"weeks": weeks, "categories": rows, "total_burn": round(total, 2)}


# ── Headcount ──────────────────────────────────────────────────────────────────

class EmployeeInput(BaseModel):
    name: str
    department: str
    annual_salary: float
    hire_date: str
    departure_date: str | None = None
    status: str = "active"

    @validator("annual_salary")
    def _pos(cls, v):
        if v <= 0: raise ValueError("annual_salary must be positive")
        return v


@headcount_router.get("")
def list_employees(user: dict = Depends(get_current_user)):
    emps = store.list_employees(user["id"])
    return [
        {**e, "name": decrypt(e["name"]) if e.get("name") else "", "weekly_cost": round(e.get("annual_salary", 0) / 52, 2)}
        for e in emps
    ]


@headcount_router.post("", status_code=201)
def add_employee(body: EmployeeInput, user: dict = Depends(get_current_user)):
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_employee(
        id=row_id, user_id=user["id"],
        name=encrypt(body.name.strip()),
        department=body.department, annual_salary=body.annual_salary,
        hire_date=body.hire_date, departure_date=body.departure_date,
        status=body.status, created_at=now,
    )
    store.record_audit("employee.create", user_id=user["id"], entity=row_id)
    return {"id": row_id}


@headcount_router.put("/{emp_id}")
def update_employee(emp_id: str, body: EmployeeInput, user: dict = Depends(get_current_user)):
    store.update_employee(
        emp_id=emp_id, user_id=user["id"],
        name=encrypt(body.name.strip()), department=body.department,
        annual_salary=body.annual_salary, hire_date=body.hire_date,
        departure_date=body.departure_date, status=body.status,
    )
    return {"ok": True}


@headcount_router.delete("/{emp_id}", status_code=204)
def delete_employee(emp_id: str, user: dict = Depends(get_current_user)):
    store.delete_employee(emp_id, user["id"])


class HeadcountPlanInput(BaseModel):
    department: str
    role: str
    annual_salary: float
    planned_start_date: str
    type: str = "hire"  # hire | departure


@headcount_router.get("/plan")
def list_headcount_plan(user: dict = Depends(get_current_user)):
    return store.list_headcount_plan(user["id"])


@headcount_router.post("/plan", status_code=201)
def add_headcount_plan(body: HeadcountPlanInput, user: dict = Depends(get_current_user)):
    if body.type not in ("hire", "departure"):
        raise HTTPException(400, "type must be hire or departure")
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_headcount_plan(
        id=row_id, user_id=user["id"],
        department=body.department, role=body.role,
        annual_salary=body.annual_salary,
        planned_start_date=body.planned_start_date,
        type=body.type, created_at=now,
    )
    return {"id": row_id}


@headcount_router.delete("/plan/{plan_id}", status_code=204)
def delete_headcount_plan(plan_id: str, user: dict = Depends(get_current_user)):
    store.delete_headcount_plan(plan_id, user["id"])
