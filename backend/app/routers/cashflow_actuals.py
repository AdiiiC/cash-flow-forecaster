"""Actuals reconciliation router.

Endpoints:
  GET    /api/cashflow-actuals          — list actual entries
  POST   /api/cashflow-actuals          — manual entry
  POST   /api/cashflow-actuals/upload   — bulk CSV/XLSX upload
  DELETE /api/cashflow-actuals/{id}     — delete entry
  GET    /api/cashflow-actuals/variance — compare actuals vs latest forecast
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime, date, timedelta, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, validator

from app import store
from app.auth import get_current_user

router = APIRouter(prefix="/cashflow-actuals", tags=["actuals"])


class ActualEntry(BaseModel):
    week_start: str       # ISO date (Monday)
    category: str
    direction: str        # inflow | outflow
    amount: float
    notes: str = ""

    @validator("direction")
    def _dir(cls, v):
        if v not in ("inflow", "outflow"):
            raise ValueError("direction must be inflow or outflow")
        return v

    @validator("amount")
    def _amt(cls, v):
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


# ── CRUD ───────────────────────────────────────────────────────────────────────

@router.get("")
def list_actuals(user: dict = Depends(get_current_user)):
    return store.list_cashflow_actuals(user["id"])


@router.post("", status_code=201)
def create_actual(body: ActualEntry, user: dict = Depends(get_current_user)):
    # Normalise to Monday of that week
    try:
        d = date.fromisoformat(body.week_start)
        monday = (d - timedelta(days=d.weekday())).isoformat()
    except ValueError:
        raise HTTPException(400, "week_start must be a valid ISO date (YYYY-MM-DD).")
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_cashflow_actual(
        id=row_id, user_id=user["id"],
        week_start=monday, category=body.category.strip(),
        direction=body.direction, amount=body.amount,
        source="manual", notes=body.notes, created_at=now,
    )
    return {"id": row_id, "week_start": monday}


@router.delete("/{entry_id}", status_code=204)
def delete_actual(entry_id: str, user: dict = Depends(get_current_user)):
    store.delete_cashflow_actual(entry_id, user["id"])


# ── CSV upload ─────────────────────────────────────────────────────────────────

@router.post("/upload", status_code=201)
async def upload_actuals(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Accepts a CSV with columns: date, category, direction, amount
    (date = any ISO date within the target week).
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file.")
    content = await file.read()
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        rows_saved = 0
        now = datetime.now(timezone.utc).isoformat()
        for i, row in enumerate(reader):
            if i > 10_000:
                raise HTTPException(400, "CSV too large (max 10 000 rows).")
            try:
                d = date.fromisoformat(row["date"].strip())
                monday = (d - timedelta(days=d.weekday())).isoformat()
                direction = row["direction"].strip().lower()
                amount = float(row["amount"].strip().replace(",", ""))
                category = row.get("category", "Uncategorised").strip() or "Uncategorised"
                if direction not in ("inflow", "outflow") or amount <= 0:
                    continue
                store.save_cashflow_actual(
                    id=uuid.uuid4().hex[:12], user_id=user["id"],
                    week_start=monday, category=category,
                    direction=direction, amount=amount,
                    source="csv", notes="", created_at=now,
                )
                rows_saved += 1
            except (KeyError, ValueError):
                continue
        return {"rows_imported": rows_saved}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Could not parse CSV: {exc}")


# ── Variance ───────────────────────────────────────────────────────────────────

@router.get("/variance")
def actuals_variance(user: dict = Depends(get_current_user)):
    """
    Compare weekly actuals to the most recent saved forecast (p50 net cash flow).
    Returns per-week variance rows.
    """
    actuals = store.list_cashflow_actuals(user["id"])
    if not actuals:
        return {"variance": [], "message": "No actuals recorded yet."}

    # Aggregate actuals by week
    df = pd.DataFrame(actuals)
    df["signed"] = df.apply(
        lambda r: r["amount"] if r["direction"] == "inflow" else -r["amount"], axis=1
    )
    weekly = df.groupby("week_start")["signed"].sum().reset_index()
    weekly.columns = ["week_start", "actual_net"]

    # Load most recent forecast
    runs = store.list_runs(user_id=user["id"], limit=1)
    if not runs:
        return {"variance": weekly.to_dict(orient="records"),
                "message": "No forecast to compare against."}

    import json
    payload = json.loads(store.get_run(runs[0]["id"])["payload"])
    # Extract net_cash_flow series p50 from the forecast
    net_series = next(
        (s for s in payload.get("series", []) if s["name"] == "net_cash_flow"), None
    )
    if not net_series:
        return {"variance": weekly.to_dict(orient="records")}

    forecast_map = {
        pt["period"]: pt["p50"] for pt in net_series.get("forecast", [])
    }
    rows = []
    for _, r in weekly.iterrows():
        wk = r["week_start"]
        f = forecast_map.get(wk)
        variance = None
        variance_pct = None
        if f is not None and f != 0:
            variance     = r["actual_net"] - f
            variance_pct = round((variance / abs(f)) * 100, 1)
        rows.append({
            "week_start":    wk,
            "actual_net":    round(r["actual_net"], 2),
            "forecast_p50":  round(f, 2) if f is not None else None,
            "variance":      round(variance, 2) if variance is not None else None,
            "variance_pct":  variance_pct,
            "status": (
                "on_track" if variance_pct is not None and abs(variance_pct) <= 10
                else "warning" if variance_pct is not None and abs(variance_pct) <= 25
                else "off_track"
            ),
        })
    cumulative_variance_pct = (
        abs(sum(r["variance_pct"] or 0 for r in rows) / len(rows))
        if rows else 0
    )
    return {
        "variance": rows,
        "cumulative_variance_pct": round(cumulative_variance_pct, 1),
        "reforecast_recommended": cumulative_variance_pct > 15,
    }
