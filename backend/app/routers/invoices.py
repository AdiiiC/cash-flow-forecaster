"""Invoice (AR) and bill (AP) endpoints (auth required).

Open items are folded into every forecast for the user as expected inflows /
outflows on their due dates. Counterparty names are encrypted at rest.
"""
from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app import store
from app.auth import get_current_user
from app.schemas import Invoice, InvoiceInput, InvoiceStatus

router = APIRouter(prefix="/invoices", tags=["invoices"])


class StatusUpdate(BaseModel):
    status: InvoiceStatus


def _as_date(v) -> date:
    return v if isinstance(v, date) else date.fromisoformat(v)


def _to_public(row: dict) -> Invoice:
    due = _as_date(row["due_date"])
    status_val = row["status"]
    overdue = status_val == InvoiceStatus.open.value and due < date.today()
    created = row["created_at"]
    return Invoice(
        id=row["id"],
        kind=row["kind"],
        counterparty=row["counterparty"],
        amount=row["amount"],
        issue_date=_as_date(row["issue_date"]),
        due_date=due,
        category=row["category"],
        status=status_val,
        overdue=overdue,
        created_at=created if isinstance(created, datetime) else datetime.fromisoformat(created),
    )


@router.get("", response_model=list[Invoice])
def list_items(user: dict = Depends(get_current_user)) -> list[Invoice]:
    return [_to_public(r) for r in store.list_invoices(user["id"])]


@router.post("", response_model=Invoice, status_code=status.HTTP_201_CREATED)
def create_item(body: InvoiceInput, user: dict = Depends(get_current_user)) -> Invoice:
    row = store.save_invoice(
        user["id"],
        kind=body.kind.value,
        counterparty=body.counterparty,
        amount=body.amount,
        issue_date=body.issue_date.isoformat(),
        due_date=body.due_date.isoformat(),
        status=body.status.value,
        category=body.category,
    )
    store.record_audit("invoice.create", user_id=user["id"], entity=row["id"])
    return _to_public(row)


@router.patch("/{invoice_id}/status", response_model=Invoice)
def update_status(
    invoice_id: str, body: StatusUpdate, user: dict = Depends(get_current_user)
) -> Invoice:
    if not store.set_invoice_status(invoice_id, user["id"], body.status.value):
        raise HTTPException(status_code=404, detail="Invoice not found.")
    store.record_audit(
        "invoice.status", user_id=user["id"], entity=invoice_id, meta={"status": body.status.value}
    )
    return _to_public(store.get_invoice(invoice_id, user["id"]))


@router.delete("/{invoice_id}")
def delete_item(invoice_id: str, user: dict = Depends(get_current_user)) -> dict:
    if not store.delete_invoice(invoice_id, user["id"]):
        raise HTTPException(status_code=404, detail="Invoice not found.")
    store.record_audit("invoice.delete", user_id=user["id"], entity=invoice_id)
    return {"deleted": invoice_id}
