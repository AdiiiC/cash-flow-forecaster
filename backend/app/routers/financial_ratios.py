"""
Financial Ratios, Break-Even Analysis, and Liquidity Score.

GET  /api/financial-ratios          — ratio grid (current, quick, gross margin, Rule of 40, etc.)
POST /api/financial-ratios/cost-structure — save fixed costs / variable cost %
GET  /api/financial-ratios/cost-structure
POST /api/break-even/calculate      — break-even analysis from cost structure
GET  /api/liquidity-score           — composite 0-100 score with rating
"""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app import store
from app.auth import get_current_user

router = APIRouter(tags=["financial-ratios"])


# ── Cost structure ─────────────────────────────────────────────────────────────

class CostStructure(BaseModel):
    fixed_costs_weekly: float = 0
    variable_cost_pct: float = 0      # 0–1
    gross_margin_pct: float = 0.70    # 0–1
    cac: float | None = None          # customer acquisition cost


@router.post("/financial-ratios/cost-structure")
def save_cost_structure(body: CostStructure, user: dict = Depends(get_current_user)):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    store.upsert_cost_structure(
        user_id=user["id"],
        fixed_costs_weekly=body.fixed_costs_weekly,
        variable_cost_pct=body.variable_cost_pct,
        gross_margin_pct=body.gross_margin_pct,
        cac=body.cac,
        updated_at=now,
    )
    return {"ok": True}


@router.get("/financial-ratios/cost-structure")
def get_cost_structure(user: dict = Depends(get_current_user)):
    cs = store.get_cost_structure(user["id"])
    return cs or {"fixed_costs_weekly": 0, "variable_cost_pct": 0,
                  "gross_margin_pct": 0.70, "cac": None}


# ── Ratios ─────────────────────────────────────────────────────────────────────

@router.get("/financial-ratios")
def financial_ratios(user: dict = Depends(get_current_user)):
    invoices  = store.get_all_invoices_for_user(user["id"])
    accounts  = store.list_cash_accounts(user["id"])
    customers = store.list_customers_mrr(user["id"])
    runs      = store.list_runs(user_id=user["id"], limit=1)
    cs        = store.get_cost_structure(user["id"]) or {}

    open_rec = [i for i in invoices if i["kind"] == "receivable" and i["status"] == "open"]
    open_pay = [i for i in invoices if i["kind"] == "payable"    and i["status"] == "open"]
    cash = sum(a["balance"] for a in accounts if a["account_type"] in ("checking", "savings"))

    total_ar = sum(i["amount"] for i in open_rec)
    total_ap = sum(i["amount"] for i in open_pay)
    ar_30 = sum(i["amount"] for i in open_rec if (date.today() - date.fromisoformat(i["due_date"])).days <= 30)
    ap_30 = sum(i["amount"] for i in open_pay if (date.today() - date.fromisoformat(i["due_date"])).days <= 30)

    current_ratio = round((cash + total_ar) / max(total_ap, 1), 2)
    quick_ratio   = round((cash + ar_30) / max(ap_30, 1), 2)

    active_mrr    = sum(c.get("arr", 0) / 12 for c in customers if c.get("status") == "active")
    gross_margin  = float(cs.get("gross_margin_pct", 0.70)) * 100

    # Rule of 40: MRR growth % + net profit margin %
    # Approximate MRR growth as 5% monthly (static; would need history for exact)
    # Net profit margin from forecast
    net_margin = 0.0
    rule_of_40 = None
    if runs:
        import json
        payload = json.loads(store.get_run(runs[0]["id"])["payload"])
        net_total = sum(
            p["p50"] for s in payload.get("series", [])
            if s["name"] == "net_cash_flow" for p in s.get("forecast", [])
        )
        inflow_total = sum(
            p["p50"] for s in payload.get("series", [])
            if s["name"] == "inflow" for p in s.get("forecast", [])
        )
        net_margin = round((net_total / inflow_total * 100) if inflow_total else 0, 1)
        # Assume 3% weekly MRR growth rate for demo (replace with cohort data when available)
        mrr_growth_pct = 5.0  # monthly
        rule_of_40 = round(mrr_growth_pct + net_margin, 1)

    cac = cs.get("cac")
    ltv_cac = None
    payback_months = None
    if cac and active_mrr > 0 and len(customers) > 0:
        avg_arr = sum(c.get("arr", 0) for c in customers if c.get("status") == "active") / max(len([c for c in customers if c.get("status") == "active"]), 1)
        ltv = avg_arr * float(cs.get("gross_margin_pct", 0.70))
        ltv_cac = round(ltv / cac, 2)
        avg_mrr = active_mrr / max(len([c for c in customers if c.get("status") == "active"]), 1)
        payback_months = round(cac / (avg_mrr * float(cs.get("gross_margin_pct", 0.70))), 1)

    return {
        "current_ratio":  current_ratio,
        "quick_ratio":    quick_ratio,
        "gross_margin_pct": round(gross_margin, 1),
        "net_margin_pct":   net_margin,
        "rule_of_40":       rule_of_40,
        "active_mrr":       round(active_mrr, 2),
        "ltv_cac_ratio":    ltv_cac,
        "payback_months":   payback_months,
        "cash_on_hand":     round(cash, 2),
        "total_ar":         round(total_ar, 2),
        "total_ap":         round(total_ap, 2),
        "benchmarks": {
            "current_ratio":  {"good": ">2.0",  "value": current_ratio, "ok": current_ratio > 1.5},
            "quick_ratio":    {"good": ">1.0",  "value": quick_ratio,   "ok": quick_ratio > 1.0},
            "rule_of_40":     {"good": ">40",   "value": rule_of_40,    "ok": (rule_of_40 or 0) >= 40},
            "ltv_cac_ratio":  {"good": ">3.0",  "value": ltv_cac,       "ok": (ltv_cac or 0) >= 3.0},
            "payback_months": {"good": "<12mo", "value": payback_months,"ok": (payback_months or 999) < 12},
        },
    }


# ── Break-even ─────────────────────────────────────────────────────────────────

class BreakEvenInput(BaseModel):
    fixed_costs_weekly: float
    variable_cost_pct: float   # 0–1
    current_weekly_revenue: float
    weekly_revenue_growth_pct: float = 0.0


@router.post("/break-even/calculate")
def break_even(body: BreakEvenInput):
    contribution_margin = 1 - body.variable_cost_pct
    if contribution_margin <= 0:
        return {"error": "variable_cost_pct must be < 1"}

    be_revenue_weekly = body.fixed_costs_weekly / contribution_margin
    margin_of_safety  = round((body.current_weekly_revenue - be_revenue_weekly) / max(be_revenue_weekly, 1) * 100, 1)

    # Weeks to break-even given growth
    weeks_to_be = None
    if body.current_weekly_revenue < be_revenue_weekly and body.weekly_revenue_growth_pct > 0:
        rev = body.current_weekly_revenue
        weeks = 0
        while rev < be_revenue_weekly and weeks < 520:
            rev *= (1 + body.weekly_revenue_growth_pct / 100)
            weeks += 1
        weeks_to_be = weeks if weeks < 520 else None

    return {
        "breakeven_weekly_revenue":  round(be_revenue_weekly, 2),
        "current_weekly_revenue":    round(body.current_weekly_revenue, 2),
        "margin_of_safety_pct":      margin_of_safety,
        "above_breakeven":           body.current_weekly_revenue >= be_revenue_weekly,
        "revenue_gap":               round(max(0, be_revenue_weekly - body.current_weekly_revenue), 2),
        "weeks_to_breakeven":        weeks_to_be,
        "contribution_margin_pct":   round(contribution_margin * 100, 1),
    }


# ── Liquidity score ────────────────────────────────────────────────────────────

@router.get("/liquidity-score")
def liquidity_score(user: dict = Depends(get_current_user)):
    """
    Composite 0–100 liquidity score.
    Components: runway (30pts) + DSO (20pts) + current_ratio (20pts) + reserve_coverage (30pts)
    """
    from app import store as _store

    accounts  = _store.list_cash_accounts(user["id"])
    runs      = _store.list_runs(user_id=user["id"], limit=1)
    policy    = _store.get_cash_policy(user["id"]) or {}
    invoices  = _store.get_all_invoices_for_user(user["id"])

    cash = sum(a["balance"] for a in accounts if a["account_type"] in ("checking", "savings"))

    # Runway from latest forecast
    runway_weeks = None
    if runs:
        import json
        payload = json.loads(_store.get_run(runs[0]["id"])["payload"])
        runway_weeks = payload.get("runway_weeks")

    # DSO from invoices
    open_rec = [i for i in invoices if i["kind"] == "receivable" and i["status"] == "open"]
    avg_dso = 0.0
    if open_rec:
        from statistics import mean
        avg_dso = mean((date.today() - date.fromisoformat(i["issue_date"])).days for i in open_rec)

    open_pay = [i for i in invoices if i["kind"] == "payable" and i["status"] == "open"]
    total_ap = sum(i["amount"] for i in open_pay)
    total_ar = sum(i["amount"] for i in open_rec)
    current_ratio = (cash + total_ar) / max(total_ap, 1)

    target_months = float(policy.get("target_reserve_months", 6))
    min_balance   = float(policy.get("min_balance_absolute") or 0)

    # Burn from recent actuals
    actuals = _store.list_cashflow_actuals(user["id"])
    cutoff = (date.today() - timedelta(weeks=4)).isoformat()
    recent_burn = sum(a["amount"] for a in actuals if a["direction"] == "outflow" and a["week_start"] >= cutoff)
    monthly_burn = recent_burn / 4 * (52 / 12)
    reserve_coverage = (cash / (monthly_burn * target_months)) if monthly_burn > 0 and target_months > 0 else 1.0

    # Scores
    runway_score = min(30, (runway_weeks or 0) / 2) if runway_weeks else (15 if cash > 0 else 0)
    dso_score    = max(0, 20 - avg_dso / 3)
    ratio_score  = min(20, current_ratio * 8)
    reserve_score = min(30, reserve_coverage * 30)

    total = round(runway_score + dso_score + ratio_score + reserve_score)
    total = max(0, min(100, total))

    return {
        "score":          total,
        "rating":         "strong" if total >= 80 else "adequate" if total >= 50 else "at_risk" if total >= 25 else "critical",
        "components": {
            "runway":           {"score": round(runway_score), "max": 30, "value": f"{runway_weeks:.0f} wks" if runway_weeks else "unknown"},
            "dso":              {"score": round(dso_score),    "max": 20, "value": f"{avg_dso:.0f} days"},
            "current_ratio":    {"score": round(ratio_score),  "max": 20, "value": f"{current_ratio:.2f}x"},
            "reserve_coverage": {"score": round(reserve_score),"max": 30, "value": f"{reserve_coverage:.1f}x target"},
        },
        "peer_benchmark": "SaaS companies at early stage typically hold 12–18 months of runway.",
        "target_reserve_months": target_months,
        "cash_on_hand":         round(cash, 2),
        "reserve_target":       round(monthly_burn * target_months, 2),
    }
