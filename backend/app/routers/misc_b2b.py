"""
Quarterly Tax Estimates + Cash Policy + Financing Timeline + Board Report.

POST/GET /api/tax/configure         — tax config CRUD
GET /api/tax/estimates              — quarterly tax payment schedule

GET/PUT  /api/cash-policy           — reserve policy

GET/POST/DELETE /api/financing      — financing events CRUD
GET /api/financing/impact           — probability-weighted runway impact

GET /api/board-report               — full CFO metrics package
"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import store
from app.auth import get_current_user

# ── Tax ───────────────────────────────────────────────────────────────────────

tax_router = APIRouter(prefix="/tax", tags=["tax"])


class TaxConfig(BaseModel):
    entity_type: str = "corporation"
    effective_tax_rate_pct: float = 21.0
    jurisdiction: str = "US"
    quarterly_months: list[int] = [4, 6, 9, 1]   # months when payments are due
    prior_year_tax: float | None = None


@tax_router.post("/configure")
def save_tax_config(body: TaxConfig, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_tax_config(
        user_id=user["id"],
        entity_type=body.entity_type,
        effective_tax_rate_pct=body.effective_tax_rate_pct,
        jurisdiction=body.jurisdiction,
        quarterly_months=json.dumps(body.quarterly_months),
        prior_year_tax=body.prior_year_tax,
        updated_at=now,
    )
    return {"ok": True}


@tax_router.get("/configure")
def get_tax_config(user: dict = Depends(get_current_user)):
    cfg = store.get_tax_config(user["id"])
    if not cfg:
        return TaxConfig().model_dump()
    cfg["quarterly_months"] = json.loads(cfg.get("quarterly_months", "[4,6,9,1]"))
    return cfg


@tax_router.get("/estimates")
def tax_estimates(user: dict = Depends(get_current_user)):
    cfg  = store.get_tax_config(user["id"]) or {}
    runs = store.list_runs(user_id=user["id"], limit=1)

    rate = float(cfg.get("effective_tax_rate_pct", 21)) / 100
    months = json.loads(cfg.get("quarterly_months", "[4,6,9,1]"))
    prior_tax = cfg.get("prior_year_tax")

    # Project net income from forecast
    annual_net = 0.0
    if runs:
        payload = json.loads(store.get_run(runs[0]["id"])["payload"])
        net_series = next((s for s in payload.get("series", []) if s["name"] == "net_cash_flow"), None)
        if net_series:
            annual_net = sum(p["p50"] for p in net_series.get("forecast", [])[:52])

    annual_tax = max(0, annual_net * rate)
    quarterly_tax = round(annual_tax / 4, 2)
    safe_harbor   = round(float(prior_tax or annual_tax) / 4, 2) if prior_tax else quarterly_tax

    today = date.today()
    payments = []
    for m in months:
        year = today.year if m >= today.month else today.year + 1
        due  = date(year, m, 15)  # US: typically 15th of month
        payments.append({
            "due_date":      str(due),
            "amount":        quarterly_tax,
            "safe_harbor":   safe_harbor,
            "pay_higher_of": round(max(quarterly_tax, safe_harbor), 2),
            "days_until":    (due - today).days,
            "status":        "upcoming" if (due - today).days > 0 else "past",
        })

    payments.sort(key=lambda p: p["due_date"])
    return {
        "estimated_annual_taxable_income": round(annual_net, 2),
        "effective_tax_rate_pct":          round(rate * 100, 1),
        "estimated_annual_tax":            round(annual_tax, 2),
        "quarterly_estimate":              quarterly_tax,
        "safe_harbor_quarterly":           safe_harbor,
        "payment_schedule":                payments,
        "next_payment":                    next((p for p in payments if p["days_until"] >= 0), None),
    }


# ── Cash Policy ───────────────────────────────────────────────────────────────

policy_router = APIRouter(prefix="/cash-policy", tags=["cash-policy"])


class CashPolicyInput(BaseModel):
    target_reserve_months: float = 6
    min_balance_absolute: float | None = None
    review_cadence: str = "monthly"


@policy_router.get("")
def get_policy(user: dict = Depends(get_current_user)):
    p = store.get_cash_policy(user["id"])
    return p or CashPolicyInput().model_dump()


@policy_router.put("")
def save_policy(body: CashPolicyInput, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_cash_policy(
        user_id=user["id"],
        target_reserve_months=body.target_reserve_months,
        min_balance_absolute=body.min_balance_absolute,
        review_cadence=body.review_cadence,
        updated_at=now,
    )
    return {"ok": True}


# ── Financing ─────────────────────────────────────────────────────────────────

financing_router = APIRouter(prefix="/financing", tags=["financing"])

FINANCING_TYPES = ("loan", "equity", "credit_draw", "grant", "revenue_based", "convertible")


class FinancingInput(BaseModel):
    type: str
    label: str
    expected_amount: float
    probability_pct: float = 100
    expected_date: str
    status: str = "planned"
    notes: str = ""


@financing_router.get("")
def list_financing(user: dict = Depends(get_current_user)):
    return store.list_financing_events(user["id"])


@financing_router.post("", status_code=201)
def create_financing(body: FinancingInput, user: dict = Depends(get_current_user)):
    if body.type not in FINANCING_TYPES:
        raise HTTPException(400, f"type must be one of {FINANCING_TYPES}")
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_financing_event(
        id=row_id, user_id=user["id"],
        type=body.type, label=body.label,
        expected_amount=body.expected_amount,
        probability_pct=body.probability_pct,
        expected_date=body.expected_date,
        status=body.status, notes=body.notes, created_at=now,
    )
    store.record_audit("financing.create", user_id=user["id"], entity=row_id)
    return {"id": row_id}


@financing_router.delete("/{event_id}", status_code=204)
def delete_financing(event_id: str, user: dict = Depends(get_current_user)):
    store.delete_financing_event(event_id, user["id"])


@financing_router.get("/impact")
def financing_impact(user: dict = Depends(get_current_user)):
    events   = store.list_financing_events(user["id"])
    runs     = store.list_runs(user_id=user["id"], limit=1)
    accounts = store.list_cash_accounts(user["id"])

    cash = sum(a["balance"] for a in accounts if a["account_type"] in ("checking", "savings"))
    base_runway_months = None
    if runs:
        payload = json.loads(store.get_run(runs[0]["id"])["payload"])
        base_runway_months = payload.get("runway_weeks", 0) / 4.33 if payload.get("runway_weeks") else None

    # Burn estimate
    actuals = store.list_cashflow_actuals(user["id"])
    cutoff  = (date.today() - timedelta(weeks=4)).isoformat()
    recent_burn = sum(a["amount"] for a in actuals if a["direction"] == "outflow" and a["week_start"] >= cutoff)
    monthly_burn = max(recent_burn / 4 * (52 / 12), 1)

    closed_inflow   = sum(e["expected_amount"] for e in events if e["status"] == "closed")
    weighted_inflow = sum(e["expected_amount"] * e["probability_pct"] / 100 for e in events if e["status"] in ("planned", "closed"))
    best_inflow     = sum(e["expected_amount"] for e in events if e["status"] in ("planned", "closed"))

    def runway(extra):
        return round((cash + extra) / monthly_burn, 1)

    return {
        "base_runway_months":     base_runway_months,
        "base_case_runway":       runway(closed_inflow),
        "expected_case_runway":   runway(weighted_inflow),
        "best_case_runway":       runway(best_inflow),
        "closed_inflow":          round(closed_inflow, 2),
        "weighted_inflow":        round(weighted_inflow, 2),
        "best_case_inflow":       round(best_inflow, 2),
        "events": [
            {**e, "weighted_amount": round(e["expected_amount"] * e["probability_pct"] / 100, 2)}
            for e in sorted(events, key=lambda e: e["expected_date"])
        ],
    }


# ── Board Report ──────────────────────────────────────────────────────────────

board_router = APIRouter(prefix="/board-report", tags=["board-report"])


@board_router.get("")
def board_report(user: dict = Depends(get_current_user)):
    """Single endpoint with all board-level KPIs, risks, and narrative."""
    runs      = store.list_runs(user_id=user["id"], limit=3)
    customers = store.list_customers_mrr(user["id"])
    accounts  = store.list_cash_accounts(user["id"])
    invoices  = store.get_all_invoices_for_user(user["id"])
    actuals   = store.list_cashflow_actuals(user["id"])
    financing = store.list_financing_events(user["id"])
    cs        = store.get_cost_structure(user["id"]) or {}

    cash = sum(a["balance"] for a in accounts if a["account_type"] in ("checking", "savings"))
    active_mrr = sum(c.get("arr", 0) / 12 for c in customers if c.get("status") == "active")
    total_arr  = sum(c.get("arr", 0) for c in customers if c.get("status") == "active")
    churn_mrr  = sum(c.get("arr", 0) / 12 for c in customers if c.get("status") == "churned")

    # Burn
    cutoff = (date.today() - timedelta(weeks=4)).isoformat()
    recent_burn = sum(a["amount"] for a in actuals if a["direction"] == "outflow" and a["week_start"] >= cutoff)
    monthly_burn = recent_burn / 4 * (52 / 12)

    # Overdue AR
    open_rec = [i for i in invoices if i["kind"] == "receivable" and i["status"] == "open"]
    overdue_ar = sum(i["amount"] for i in open_rec if (date.today() - date.fromisoformat(i["due_date"])).days > 30)

    # Latest forecast KPIs
    runway_weeks = None
    projected_balance = None
    if runs:
        payload = json.loads(store.get_run(runs[0]["id"])["payload"])
        runway_weeks      = payload.get("runway_weeks")
        projected_balance = payload.get("projected_balance_p50")
        calibration       = payload.get("calibration", {})

    # Gross margin from config
    gross_margin_pct = float(cs.get("gross_margin_pct", 0.70)) * 100

    # Rule of 40 (static 5% monthly growth assumption)
    net_margin = 0
    rule_of_40 = None
    if runs and monthly_burn > 0 and active_mrr > 0:
        net_margin = round((active_mrr - monthly_burn) / max(active_mrr, 1) * 100, 1)
        rule_of_40 = round(5.0 + net_margin, 1)

    # Risks
    risks = []
    if runway_weeks and runway_weeks < 26:
        risks.append({"severity": "critical", "message": f"Runway is {runway_weeks:.0f} weeks — below 6-month threshold."})
    if overdue_ar > cash * 0.1:
        risks.append({"severity": "warning", "message": f"Overdue AR of ${overdue_ar:,.0f} is >10% of cash on hand."})
    if churn_mrr > active_mrr * 0.05:
        risks.append({"severity": "warning", "message": f"Monthly churn of ${churn_mrr:,.0f} exceeds 5% of active MRR."})
    if active_mrr > 0 and len([c for c in customers if c.get("status") == "active"]) > 0:
        top_pct = max(c.get("arr", 0) for c in customers if c.get("status") == "active") / max(total_arr, 1)
        if top_pct > 0.25:
            risks.append({"severity": "warning", "message": f"Top customer is {top_pct*100:.0f}% of ARR — concentration risk."})

    # Financing pipeline
    open_financing = sum(e["expected_amount"] * e["probability_pct"] / 100 for e in financing if e["status"] == "planned")

    return {
        "as_of":             date.today().isoformat(),
        "kpis": {
            "cash_on_hand":        round(cash, 2),
            "active_mrr":          round(active_mrr, 2),
            "total_arr":           round(total_arr, 2),
            "monthly_burn":        round(monthly_burn, 2),
            "runway_weeks":        runway_weeks,
            "runway_months":       round(runway_weeks / 4.33, 1) if runway_weeks else None,
            "projected_balance":   projected_balance,
            "gross_margin_pct":    round(gross_margin_pct, 1),
            "net_margin_pct":      net_margin,
            "rule_of_40":          rule_of_40,
            "churn_mrr":           round(churn_mrr, 2),
            "overdue_ar":          round(overdue_ar, 2),
            "open_financing_pipeline": round(open_financing, 2),
        },
        "risks":   sorted(risks, key=lambda r: r["severity"]),
        "history": [
            {"run_id": r["id"], "label": r["label"], "created_at": r["created_at"],
             "projected_balance": r["projected_balance_p50"],
             "runway_weeks": r["runway_weeks"]}
            for r in runs
        ],
        "customer_count":    len(customers),
        "active_customers":  len([c for c in customers if c.get("status") == "active"]),
    }
