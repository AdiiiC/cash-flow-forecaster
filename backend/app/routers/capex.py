"""
CapEx Planning, Depreciation & Free Cash Flow.
Table: capex_items

GET/POST/DELETE /api/capex          — CapEx item CRUD
GET /api/capex/schedule             — depreciation schedule per item
GET /api/capex/free-cash-flow       — operating CF − projected CapEx per week
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, validator

from app import store
from app.auth import get_current_user

router = APIRouter(prefix="/capex", tags=["capex"])

CAPEX_CATEGORIES = ("equipment", "software", "leasehold", "vehicle", "other")


class CapExInput(BaseModel):
    name: str
    amount: float
    purchase_date: str
    useful_life_years: float = 3.0
    category: str = "equipment"

    @validator("useful_life_years")
    def _pos(cls, v):
        if v <= 0: raise ValueError("useful_life_years must be positive")
        return v

    @validator("amount")
    def _amt(cls, v):
        if v <= 0: raise ValueError("amount must be positive")
        return v


@router.get("")
def list_capex(user: dict = Depends(get_current_user)):
    items = store.list_capex_items(user["id"])
    today = date.today()
    result = []
    for item in items:
        weekly_dep = item["amount"] / (item["useful_life_years"] * 52)
        purchase   = date.fromisoformat(item["purchase_date"])
        weeks_elapsed = (today - purchase).days / 7
        accumulated   = min(weekly_dep * weeks_elapsed, item["amount"])
        book_value    = max(0, item["amount"] - accumulated)
        result.append({
            **item,
            "weekly_depreciation": round(weekly_dep, 2),
            "accumulated_depreciation": round(accumulated, 2),
            "net_book_value": round(book_value, 2),
        })
    return result


@router.post("", status_code=201)
def add_capex(body: CapExInput, user: dict = Depends(get_current_user)):
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_capex_item(
        id=row_id, user_id=user["id"],
        name=body.name.strip(), amount=body.amount,
        purchase_date=body.purchase_date,
        useful_life_years=body.useful_life_years,
        category=body.category, created_at=now,
    )
    return {"id": row_id}


@router.delete("/{item_id}", status_code=204)
def delete_capex(item_id: str, user: dict = Depends(get_current_user)):
    store.delete_capex_item(item_id, user["id"])


@router.get("/schedule")
def depreciation_schedule(user: dict = Depends(get_current_user)):
    items = store.list_capex_items(user["id"])
    today = date.today()
    rows = []
    for item in items:
        weekly_dep = item["amount"] / (item["useful_life_years"] * 52)
        purchase   = date.fromisoformat(item["purchase_date"])
        fully_depreciated = date.fromordinal(
            purchase.toordinal() + int(item["useful_life_years"] * 365)
        )
        weeks_elapsed  = max(0, (today - purchase).days / 7)
        accumulated    = min(weekly_dep * weeks_elapsed, item["amount"])
        book_value     = max(0, item["amount"] - accumulated)
        rows.append({
            "name":              item["name"],
            "category":          item["category"],
            "purchase_date":     item["purchase_date"],
            "amount":            item["amount"],
            "useful_life_years": item["useful_life_years"],
            "weekly_depreciation": round(weekly_dep, 2),
            "annual_depreciation": round(weekly_dep * 52, 2),
            "accumulated":         round(accumulated, 2),
            "net_book_value":      round(book_value, 2),
            "fully_depreciated_date": str(fully_depreciated),
            "pct_depreciated":    round(accumulated / item["amount"] * 100, 1),
        })
    total_weekly_dep = sum(r["weekly_depreciation"] for r in rows)
    total_book_value = sum(r["net_book_value"] for r in rows)
    return {
        "items": rows,
        "total_weekly_depreciation": round(total_weekly_dep, 2),
        "total_annual_depreciation": round(total_weekly_dep * 52, 2),
        "total_net_book_value":      round(total_book_value, 2),
    }


@router.get("/free-cash-flow")
def free_cash_flow(weeks: int = 13, user: dict = Depends(get_current_user)):
    """Operating cash flow (forecast p50) minus projected CapEx per week."""
    runs  = store.list_runs(user_id=user["id"], limit=1)
    items = store.list_capex_items(user["id"])
    total_weekly_capex = sum(i["amount"] / (i["useful_life_years"] * 52) * 0.3 for i in items)  # ~30% cash capex proxy

    fcf_rows = []
    if runs:
        import json
        payload = json.loads(store.get_run(runs[0]["id"])["payload"])
        net_series = next((s for s in payload.get("series", []) if s["name"] == "net_cash_flow"), None)
        if net_series:
            for pt in net_series.get("forecast", [])[:weeks]:
                op_cf = pt["p50"]
                fcf   = op_cf - total_weekly_capex
                fcf_rows.append({
                    "period":    pt["period"],
                    "op_cf_p50": round(op_cf, 2),
                    "capex":     round(total_weekly_capex, 2),
                    "fcf":       round(fcf, 2),
                })

    cumulative_fcf = 0.0
    for row in fcf_rows:
        cumulative_fcf += row["fcf"]
        row["cumulative_fcf"] = round(cumulative_fcf, 2)

    return {
        "weekly_rows":         fcf_rows,
        "total_fcf":           round(sum(r["fcf"] for r in fcf_rows), 2),
        "total_capex_cash":    round(total_weekly_capex * weeks, 2),
        "weekly_capex":        round(total_weekly_capex, 2),
    }
