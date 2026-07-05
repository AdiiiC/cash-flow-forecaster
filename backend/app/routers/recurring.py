"""Recurring scheduled-item endpoints (auth required).

Users register known repeating cash events (payroll, rent, subscriptions,
retainers). Active items are folded into every forecast for that user so the
projected runway reflects committed future cash, not just the statistical trend.
"""
from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app import store
from app.auth import get_current_user
from app.schemas import RecurringItem, RecurringItemInput

router = APIRouter(prefix="/recurring", tags=["recurring"])


def _to_public(row: dict) -> RecurringItem:
    created = row["created_at"]
    anchor = row["anchor_date"]
    return RecurringItem(
        id=row["id"],
        name=row["name"],
        amount=row["amount"],
        direction=row["direction"],
        cadence=row["cadence"],
        anchor_date=anchor if isinstance(anchor, date) else date.fromisoformat(anchor),
        category=row["category"],
        active=bool(row["active"]),
        created_at=created if isinstance(created, datetime) else datetime.fromisoformat(created),
    )


@router.get("", response_model=list[RecurringItem])
def list_items(user: dict = Depends(get_current_user)) -> list[RecurringItem]:
    return [_to_public(r) for r in store.list_recurring(user["id"])]


@router.post("", response_model=RecurringItem, status_code=status.HTTP_201_CREATED)
def create_item(
    body: RecurringItemInput, user: dict = Depends(get_current_user)
) -> RecurringItem:
    row = store.save_recurring(
        user["id"],
        name=body.name,
        amount=body.amount,
        direction=body.direction.value,
        cadence=body.cadence.value,
        anchor_date=body.anchor_date.isoformat(),
        category=body.category,
        active=body.active,
    )
    store.record_audit("recurring.create", user_id=user["id"], entity=row["id"])
    return _to_public(row)


@router.delete("/{item_id}")
def delete_item(item_id: str, user: dict = Depends(get_current_user)) -> dict:
    if not store.delete_recurring(item_id, user["id"]):
        raise HTTPException(status_code=404, detail="Recurring item not found.")
    store.record_audit("recurring.delete", user_id=user["id"], entity=item_id)
    return {"deleted": item_id}
