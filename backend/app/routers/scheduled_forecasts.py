"""Scheduled / rolling forecasts router.

Endpoints:
  GET    /api/scheduled-forecasts        — list schedules
  POST   /api/scheduled-forecasts        — create schedule
  PATCH  /api/scheduled-forecasts/{id}   — toggle active/pause
  DELETE /api/scheduled-forecasts/{id}   — remove schedule
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import store
from app.auth import get_current_user

router = APIRouter(prefix="/scheduled-forecasts", tags=["scheduled"])


def _next_run(cadence: str, day_of_week: int) -> str:
    """Return the next ISO datetime when this schedule should fire."""
    now = datetime.now(timezone.utc)
    if cadence == "weekly":
        days_ahead = (day_of_week - now.weekday()) % 7 or 7
        nxt = now.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=days_ahead)
    elif cadence == "monthly":
        nxt = now.replace(day=1, hour=9, minute=0, second=0, microsecond=0)
        if nxt <= now:
            month = nxt.month + 1 if nxt.month < 12 else 1
            year  = nxt.year if nxt.month < 12 else nxt.year + 1
            nxt = nxt.replace(year=year, month=month)
    else:
        nxt = now + timedelta(days=7)
    return nxt.isoformat()


class ScheduledForecastInput(BaseModel):
    label: str
    cadence: str = "weekly"      # weekly | monthly
    day_of_week: int = 1         # 0=Mon … 6=Sun (for weekly)
    weeks: int = 104
    starting_mrr: float = 80_000
    opening_balance: float = 250_000
    currency: str = "USD"


@router.get("")
def list_schedules(user: dict = Depends(get_current_user)):
    return store.list_scheduled_forecasts(user["id"])


@router.post("", status_code=201)
def create_schedule(body: ScheduledForecastInput, user: dict = Depends(get_current_user)):
    if body.cadence not in ("weekly", "monthly"):
        raise HTTPException(400, "cadence must be weekly or monthly")
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    config = {
        "weeks": body.weeks,
        "starting_mrr": body.starting_mrr,
        "opening_balance": body.opening_balance,
        "currency": body.currency,
        "seed": 42,
    }
    store.save_scheduled_forecast(
        id=row_id, user_id=user["id"],
        label=body.label, cadence=body.cadence,
        day_of_week=body.day_of_week,
        config_json=json.dumps(config),
        next_run_at=_next_run(body.cadence, body.day_of_week),
        created_at=now,
    )
    return {"id": row_id, "next_run_at": _next_run(body.cadence, body.day_of_week)}


@router.patch("/{sched_id}/toggle")
def toggle_schedule(sched_id: str, user: dict = Depends(get_current_user)):
    sched = store.get_scheduled_forecast(sched_id, user["id"])
    if not sched:
        raise HTTPException(404, "Schedule not found.")
    new_active = 0 if sched["active"] else 1
    store.update_scheduled_forecast_active(sched_id, new_active)
    return {"active": bool(new_active)}


@router.delete("/{sched_id}", status_code=204)
def delete_schedule(sched_id: str, user: dict = Depends(get_current_user)):
    store.delete_scheduled_forecast(sched_id, user["id"])
