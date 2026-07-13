"""
ARR Waterfall & Revenue Recognition.
Tables: bookings

GET/POST/DELETE /api/bookings        — booking CRUD
GET /api/arr-waterfall               — MRR movement (new/expansion/contraction/churn)
GET /api/revenue-recognition         — deferred revenue schedule
GET /api/concentration-risk/customers — customer HHI + revenue concentration
GET /api/concentration-risk/vendors   — vendor spend concentration
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import store
from app.auth import get_current_user
from app.security.crypto import decrypt, encrypt

router = APIRouter(tags=["arr-revenue"])
conc_router = APIRouter(prefix="/concentration-risk", tags=["risk"])


# ── Bookings ───────────────────────────────────────────────────────────────────

class BookingInput(BaseModel):
    customer_name: str
    booking_date: str
    contract_value: float
    term_months: int = 12
    start_date: str
    status: str = "active"

    def validate_status(self):
        if self.status not in ("active", "churned", "pending"):
            raise HTTPException(400, "status must be active, churned, or pending")


booking_router = APIRouter(prefix="/bookings", tags=["bookings"])


@booking_router.get("")
def list_bookings(user: dict = Depends(get_current_user)):
    rows = store.list_bookings(user["id"])
    return [{**r, "customer_name": decrypt(r["customer_name"]) if r.get("customer_name") else ""} for r in rows]


@booking_router.post("", status_code=201)
def create_booking(body: BookingInput, user: dict = Depends(get_current_user)):
    body.validate_status()
    row_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.save_booking(
        id=row_id, user_id=user["id"],
        customer_name=encrypt(body.customer_name.strip()),
        booking_date=body.booking_date, contract_value=body.contract_value,
        term_months=body.term_months, start_date=body.start_date,
        status=body.status, created_at=now,
    )
    return {"id": row_id}


@booking_router.delete("/{booking_id}", status_code=204)
def delete_booking(booking_id: str, user: dict = Depends(get_current_user)):
    store.delete_booking(booking_id, user["id"])


# ── ARR Waterfall ──────────────────────────────────────────────────────────────

@router.get("/arr-waterfall")
def arr_waterfall(user: dict = Depends(get_current_user)):
    """
    Compute MRR movement waterfall from customers_mrr.
    Uses current customer statuses (simplified deterministic model).
    """
    customers = store.list_customers_mrr(user["id"])
    if not customers:
        return {"message": "No customers found. Add customers via /api/customers-mrr."}

    active  = [c for c in customers if c.get("status") == "active"]
    at_risk = [c for c in customers if c.get("status") == "at_risk"]
    churned = [c for c in customers if c.get("status") == "churned"]

    def mrr(lst): return sum(c.get("arr", 0) / 12 for c in lst)

    total_mrr     = mrr(customers)
    active_mrr    = mrr(active)
    at_risk_mrr   = mrr(at_risk)
    churned_mrr   = mrr(churned)

    # Simplified waterfall from bookings if available
    bookings = store.list_bookings(user["id"])
    new_mrr = sum(b["contract_value"] / b["term_months"] for b in bookings if b["status"] == "active") if bookings else active_mrr * 0.1

    return {
        "total_mrr":    round(total_mrr, 2),
        "active_mrr":   round(active_mrr, 2),
        "at_risk_mrr":  round(at_risk_mrr, 2),
        "churned_mrr":  round(churned_mrr, 2),
        "new_mrr":      round(new_mrr, 2),
        "net_new_mrr":  round(new_mrr - churned_mrr, 2),
        "waterfall": [
            {"label": "Opening MRR",  "value": round(active_mrr + churned_mrr, 2), "type": "absolute"},
            {"label": "New",          "value": round(new_mrr, 2),     "type": "positive"},
            {"label": "Expansion",    "value": round(active_mrr * 0.05, 2), "type": "positive"},
            {"label": "Contraction",  "value": round(at_risk_mrr * 0.1, 2), "type": "negative"},
            {"label": "Churned",      "value": round(churned_mrr, 2), "type": "negative"},
            {"label": "Closing MRR",  "value": round(active_mrr, 2),  "type": "total"},
        ],
        "customer_count": len(customers),
        "churn_rate_pct": round(churned_mrr / max(total_mrr + churned_mrr, 1) * 100, 1),
    }


@router.get("/revenue-recognition")
def revenue_recognition(user: dict = Depends(get_current_user)):
    """Deferred revenue schedule from bookings (SaaS upfront payments)."""
    bookings = store.list_bookings(user["id"])
    today = date.today()

    rows = []
    total_deferred = 0.0
    for b in bookings:
        if b.get("status") != "active":
            continue
        monthly_recognition = b["contract_value"] / max(b["term_months"], 1)
        start = date.fromisoformat(b["start_date"])
        months_elapsed = max(0, (today.year - start.year) * 12 + today.month - start.month)
        recognized = min(months_elapsed * monthly_recognition, b["contract_value"])
        deferred   = b["contract_value"] - recognized
        total_deferred += deferred
        customer = decrypt(b["customer_name"]) if b.get("customer_name") else "Unknown"
        rows.append({
            "customer":           customer,
            "contract_value":     round(b["contract_value"], 2),
            "term_months":        b["term_months"],
            "monthly_recognized": round(monthly_recognition, 2),
            "recognized_to_date": round(recognized, 2),
            "deferred_balance":   round(deferred, 2),
            "start_date":         b["start_date"],
        })

    return {
        "bookings": rows,
        "total_deferred_revenue":  round(total_deferred, 2),
        "total_contract_value":    round(sum(b["contract_value"] for b in bookings if b.get("status") == "active"), 2),
    }


# ── Concentration Risk ─────────────────────────────────────────────────────────

@conc_router.get("/customers")
def customer_concentration(user: dict = Depends(get_current_user)):
    customers = store.list_customers_mrr(user["id"])
    active = [c for c in customers if c.get("status") == "active"]
    total_arr = sum(c.get("arr", 0) for c in active)
    if not active or total_arr == 0:
        return {"message": "No active customers."}

    ranked = sorted(active, key=lambda c: c.get("arr", 0), reverse=True)
    top3_arr = sum(c.get("arr", 0) for c in ranked[:3])
    top3_pct = round(top3_arr / total_arr * 100, 1)

    # Herfindahl-Hirschman Index (HHI) — sum of squared market shares (0–10,000)
    hhi = round(sum((c.get("arr", 0) / total_arr * 100) ** 2 for c in active))
    cliff_risk = any(c.get("arr", 0) / total_arr > 0.25 for c in active)

    return {
        "total_arr":        round(total_arr, 2),
        "customer_count":   len(active),
        "top_3_arr_pct":    top3_pct,
        "hhi":              hhi,
        "concentration_label": "Diversified" if hhi < 1500 else "Moderate" if hhi < 2500 else "Concentrated",
        "cliff_risk":       cliff_risk,
        "arr_at_risk_if_top_churns": round(ranked[0].get("arr", 0) if ranked else 0, 2),
        "top_customers": [
            {"name": decrypt(c["name"]) if c.get("name") else "Unknown",
             "arr": round(c.get("arr", 0), 2),
             "arr_pct": round(c.get("arr", 0) / total_arr * 100, 1)}
            for c in ranked[:5]
        ],
    }


@conc_router.get("/vendors")
def vendor_concentration(user: dict = Depends(get_current_user)):
    invoices = store.get_all_invoices_for_user(user["id"])
    payables = [i for i in invoices if i["kind"] == "payable"]
    if not payables:
        return {"message": "No payable invoices recorded."}

    vendor_spend: dict[str, float] = {}
    for inv in payables:
        name = decrypt(inv["counterparty"]) if inv.get("counterparty") else "Unknown"
        vendor_spend[name] = vendor_spend.get(name, 0) + inv["amount"]

    total = sum(vendor_spend.values())
    ranked = sorted(vendor_spend.items(), key=lambda x: x[1], reverse=True)
    top3 = sum(v for _, v in ranked[:3])
    hhi = round(sum((v / total * 100) ** 2 for _, v in ranked))

    return {
        "total_ap_spend":   round(total, 2),
        "vendor_count":     len(ranked),
        "top_3_spend_pct":  round(top3 / total * 100, 1),
        "hhi":              hhi,
        "concentration_label": "Diversified" if hhi < 1500 else "Moderate" if hhi < 2500 else "Concentrated",
        "top_vendors": [
            {"name": name, "spend": round(amt, 2), "pct": round(amt / total * 100, 1)}
            for name, amt in ranked[:5]
        ],
    }
