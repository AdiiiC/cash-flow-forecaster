"""Budget management router.

Endpoints:
  GET    /api/budget              — list budget lines
  POST   /api/budget              — create a budget line
  PUT    /api/budget/{id}         — update a line
  DELETE /api/budget/{id}         — delete a line
  POST   /api/budget/upload       — bulk CSV import
  GET    /api/budget/variance     — budget vs forecast comparison
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, validator

from app import store
from app.auth import get_current_user

router = APIRouter(prefix="/budget", tags=["budget"])


class BudgetLine(BaseModel):
    fiscal_year: int
    category: str
    direction: str        # inflow | outflow
    weekly_amount: float
    label: str = ""

    @validator("direction")
    def _dir(cls, v):
        if v not in ("inflow", "outflow"):
            raise ValueError("direction must be inflow or outflow")
        return v

    @validator("weekly_amount")
    def _pos(cls, v):
        if v <= 0:
            raise ValueError("weekly_amount must be positive")
        return v


@router.get("")
def list_budgets(fiscal_year: int | None = None, user: dict = Depends(get_current_user)):
    return store.list_budgets(user["id"], fiscal_year=fiscal_year)


@router.post("", status_code=201)
def create_budget(body: BudgetLine, user: dict = Depends(get_current_user)):
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_budget(
        id=row_id, user_id=user["id"],
        fiscal_year=body.fiscal_year, category=body.category.strip(),
        direction=body.direction, weekly_amount=body.weekly_amount,
        label=body.label, created_at=now,
    )
    return {"id": row_id}


@router.put("/{budget_id}")
def update_budget(budget_id: str, body: BudgetLine, user: dict = Depends(get_current_user)):
    store.update_budget(
        budget_id=budget_id, user_id=user["id"],
        weekly_amount=body.weekly_amount, label=body.label,
    )
    return {"ok": True}


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: str, user: dict = Depends(get_current_user)):
    store.delete_budget(budget_id, user["id"])


@router.post("/upload", status_code=201)
async def upload_budget(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """CSV columns: fiscal_year, category, direction, weekly_amount, label"""
    content = await file.read()
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        saved = 0
        now = datetime.now(timezone.utc).isoformat()
        for row in reader:
            try:
                store.save_budget(
                    id=uuid.uuid4().hex[:12],
                    user_id=user["id"],
                    fiscal_year=int(row["fiscal_year"]),
                    category=row["category"].strip(),
                    direction=row["direction"].strip().lower(),
                    weekly_amount=float(row["weekly_amount"].replace(",", "")),
                    label=row.get("label", ""),
                    created_at=now,
                )
                saved += 1
            except (KeyError, ValueError):
                continue
        return {"rows_imported": saved}
    except Exception as exc:
        raise HTTPException(400, f"Could not parse CSV: {exc}")


@router.get("/variance")
def budget_variance(fiscal_year: int | None = None, user: dict = Depends(get_current_user)):
    """Compare per-category budget to forecast + actuals."""
    import json
    from datetime import date

    year = fiscal_year or date.today().year
    budgets = store.list_budgets(user["id"], fiscal_year=year)
    if not budgets:
        return {"message": "No budget lines found for this fiscal year.", "rows": []}

    budget_map: dict[tuple, float] = {}
    for b in budgets:
        key = (b["category"], b["direction"])
        budget_map[key] = b["weekly_amount"]

    # Load latest forecast for comparison
    runs = store.list_runs(user_id=user["id"], limit=1)
    forecast_cat: dict[tuple, float] = {}
    if runs:
        payload = json.loads(store.get_run(runs[0]["id"])["payload"])
        for cat in payload.get("categories", []):
            key = (cat["category"], cat["direction"])
            forecast_cat[key] = cat.get("hist_weekly_mean", 0)

    # Actuals for this year
    actuals = store.list_cashflow_actuals(user["id"])
    actuals_map: dict[tuple, float] = {}
    if actuals:
        for a in actuals:
            if str(year) in a["week_start"]:
                key = (a["category"], a["direction"])
                actuals_map[key] = actuals_map.get(key, 0) + a["amount"]
        # Convert totals to weekly avg
        for k in actuals_map:
            actuals_map[k] = actuals_map[k] / 52

    rows = []
    for (category, direction), budgeted_weekly in budget_map.items():
        forecast_weekly = forecast_cat.get((category, direction), 0)
        actual_weekly   = actuals_map.get((category, direction), 0)
        forecast_pct = round((forecast_weekly / budgeted_weekly - 1) * 100, 1) if budgeted_weekly else 0
        actual_pct   = round((actual_weekly / budgeted_weekly - 1) * 100, 1) if budgeted_weekly else 0
        rows.append({
            "category":        category,
            "direction":       direction,
            "budgeted_weekly": round(budgeted_weekly, 2),
            "forecast_weekly": round(forecast_weekly, 2),
            "actual_weekly":   round(actual_weekly, 2),
            "forecast_vs_budget_pct": forecast_pct,
            "actual_vs_budget_pct":   actual_pct,
            "status": (
                "on_budget"   if abs(forecast_pct) <= 10
                else "warning"   if abs(forecast_pct) <= 25
                else "over_budget"
            ),
        })
    return {"fiscal_year": year, "rows": rows}
