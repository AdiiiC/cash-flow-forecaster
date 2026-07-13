"""Customer MRR tracking router.

Endpoints:
  GET    /api/customers-mrr              — list customers
  POST   /api/customers-mrr              — add customer
  PUT    /api/customers-mrr/{id}         — update customer
  DELETE /api/customers-mrr/{id}         — remove customer
  GET    /api/customers-mrr/mrr-movement — MRR waterfall (new/expansion/churn)
  GET    /api/customers-mrr/churn-risk   — customers whose contracts expire in horizon
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, validator

from app import store
from app.auth import get_current_user
from app.security.crypto import decrypt, encrypt

router = APIRouter(prefix="/customers-mrr", tags=["customers"])


class CustomerInput(BaseModel):
    name: str
    arr: float = 0.0
    contract_start: str | None = None
    contract_end: str | None = None
    renewal_probability: float = 0.8
    status: str = "active"
    billing_cycle: str = "monthly"

    @validator("status")
    def _status(cls, v):
        if v not in ("active", "at_risk", "churned"):
            raise ValueError("status must be active, at_risk, or churned")
        return v

    @validator("renewal_probability")
    def _prob(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("renewal_probability must be between 0 and 1")
        return v


def _fmt(row: dict) -> dict:
    row = dict(row)
    row["name"] = decrypt(row["name"]) if row.get("name") else ""
    row["mrr"] = round(row.get("arr", 0) / 12, 2)
    return row


@router.get("")
def list_customers(user: dict = Depends(get_current_user)):
    return [_fmt(r) for r in store.list_customers_mrr(user["id"])]


@router.post("", status_code=201)
def create_customer(body: CustomerInput, user: dict = Depends(get_current_user)):
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_customer_mrr(
        id=row_id, user_id=user["id"],
        name=encrypt(body.name.strip()),
        arr=body.arr,
        contract_start=body.contract_start,
        contract_end=body.contract_end,
        renewal_probability=body.renewal_probability,
        status=body.status,
        billing_cycle=body.billing_cycle,
        created_at=now,
    )
    store.record_audit("customer.create", user_id=user["id"], entity=row_id)
    return {"id": row_id}


@router.put("/{customer_id}")
def update_customer(customer_id: str, body: CustomerInput,
                    user: dict = Depends(get_current_user)):
    store.update_customer_mrr(
        customer_id=customer_id, user_id=user["id"],
        name=encrypt(body.name.strip()),
        arr=body.arr,
        contract_start=body.contract_start,
        contract_end=body.contract_end,
        renewal_probability=body.renewal_probability,
        status=body.status,
        billing_cycle=body.billing_cycle,
    )
    store.record_audit("customer.update", user_id=user["id"], entity=customer_id)
    return {"ok": True}


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: str, user: dict = Depends(get_current_user)):
    store.delete_customer_mrr(customer_id, user["id"])
    store.record_audit("customer.delete", user_id=user["id"], entity=customer_id)


@router.get("/mrr-movement")
def mrr_movement(user: dict = Depends(get_current_user)):
    """
    Compute a simplified MRR waterfall:
    opening_mrr + new + expansion - contraction - churned = closing_mrr
    Derived from current customer statuses (no history, deterministic).
    """
    customers = store.list_customers_mrr(user["id"])
    total_mrr  = sum(c.get("arr", 0) / 12 for c in customers)
    active_mrr = sum(c.get("arr", 0) / 12 for c in customers if c.get("status") == "active")
    at_risk    = sum(c.get("arr", 0) / 12 for c in customers if c.get("status") == "at_risk")
    churned    = sum(c.get("arr", 0) / 12 for c in customers if c.get("status") == "churned")
    return {
        "total_mrr":   round(total_mrr, 2),
        "active_mrr":  round(active_mrr, 2),
        "at_risk_mrr": round(at_risk, 2),
        "churned_mrr": round(churned, 2),
        "net_new_mrr": round(active_mrr - churned, 2),
        "customer_count": len(customers),
        "at_risk_count":  sum(1 for c in customers if c.get("status") == "at_risk"),
        "churned_count":  sum(1 for c in customers if c.get("status") == "churned"),
    }


@router.get("/churn-risk")
def churn_risk(horizon_weeks: int = 13, user: dict = Depends(get_current_user)):
    """List customers whose contracts expire within the forecast horizon."""
    today = date.today()
    horizon_end = today + timedelta(weeks=horizon_weeks)
    customers = store.list_customers_mrr(user["id"])
    at_risk = []
    for c in customers:
        end = c.get("contract_end")
        if not end:
            continue
        try:
            end_date = date.fromisoformat(end)
            if today <= end_date <= horizon_end and c.get("status") != "churned":
                row = _fmt(c)
                row["days_until_expiry"] = (end_date - today).days
                at_risk.append(row)
        except ValueError:
            continue
    at_risk.sort(key=lambda r: r["days_until_expiry"])
    return {
        "at_risk": at_risk,
        "arr_at_risk": round(sum(c.get("arr", 0) for c in at_risk), 2),
    }
