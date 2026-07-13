"""Cash accounts router (bank accounts, credit lines, savings).

Endpoints:
  GET    /api/accounts           — list accounts
  POST   /api/accounts           — add account
  PUT    /api/accounts/{id}      — update balance / settings
  DELETE /api/accounts/{id}      — remove account
  GET    /api/accounts/summary   — aggregated balance + available credit
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, validator

from app import store
from app.auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])

ACCOUNT_TYPES = ("checking", "savings", "credit_line", "investment", "other")


class AccountInput(BaseModel):
    name: str
    account_type: str = "checking"
    balance: float = 0.0
    credit_limit: float | None = None
    currency: str = "USD"
    as_of: str | None = None

    @validator("account_type")
    def _type(cls, v):
        if v not in ACCOUNT_TYPES:
            raise ValueError(f"account_type must be one of {ACCOUNT_TYPES}")
        return v


@router.get("")
def list_accounts(user: dict = Depends(get_current_user)):
    return store.list_cash_accounts(user["id"])


@router.post("", status_code=201)
def create_account(body: AccountInput, user: dict = Depends(get_current_user)):
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_cash_account(
        id=row_id, user_id=user["id"],
        name=body.name.strip(),
        account_type=body.account_type,
        balance=body.balance,
        credit_limit=body.credit_limit,
        currency=body.currency.upper(),
        as_of=body.as_of or date.today().isoformat(),
        created_at=now,
    )
    store.record_audit("account.create", user_id=user["id"], entity=row_id)
    return {"id": row_id}


@router.put("/{account_id}")
def update_account(account_id: str, body: AccountInput,
                   user: dict = Depends(get_current_user)):
    store.update_cash_account(
        account_id=account_id, user_id=user["id"],
        balance=body.balance, as_of=body.as_of or date.today().isoformat(),
        name=body.name.strip(), credit_limit=body.credit_limit,
    )
    return {"ok": True}


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: str, user: dict = Depends(get_current_user)):
    store.delete_cash_account(account_id, user["id"])


@router.get("/summary")
def account_summary(user: dict = Depends(get_current_user)):
    accounts = store.list_cash_accounts(user["id"])
    liquid   = sum(a["balance"] for a in accounts
                   if a["account_type"] in ("checking", "savings"))
    credit_drawn = sum(
        max(0, -a["balance"]) for a in accounts if a["account_type"] == "credit_line"
    )
    credit_limit = sum(
        a.get("credit_limit") or 0 for a in accounts if a["account_type"] == "credit_line"
    )
    available_credit = max(0, credit_limit - credit_drawn)
    return {
        "total_liquid":       round(liquid, 2),
        "credit_drawn":       round(credit_drawn, 2),
        "credit_limit":       round(credit_limit, 2),
        "available_credit":   round(available_credit, 2),
        "net_available":      round(liquid + available_credit, 2),
        "account_count":      len(accounts),
    }
