"""
Working Capital Intelligence — DSO, DPO, Cash Conversion Cycle, AR Aging.

GET /api/working-capital/metrics     — DSO, DPO, CCC, current ratio, quick ratio
GET /api/working-capital/ar-aging    — AR buckets per counterparty
GET /api/working-capital/ap-aging    — AP outstanding per vendor
"""
from __future__ import annotations

from datetime import date, timedelta
from statistics import mean

from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app import store
from app.security.crypto import decrypt

router = APIRouter(prefix="/working-capital", tags=["working-capital"])


def _days_between(d1: str, d2: str | None = None) -> float:
    try:
        start = date.fromisoformat(d1)
        end   = date.fromisoformat(d2) if d2 else date.today()
        return max(0.0, (end - start).days)
    except (ValueError, TypeError):
        return 0.0


@router.get("/metrics")
def working_capital_metrics(user: dict = Depends(get_current_user)):
    invoices = store.get_all_invoices_for_user(user["id"])
    today = date.today()

    receivables = [i for i in invoices if i["kind"] == "receivable"]
    payables    = [i for i in invoices if i["kind"] == "payable"]

    # DSO — average days from issue to collection (paid) or today if still open
    paid_rec = [i for i in receivables if i["status"] == "paid"]
    open_rec = [i for i in receivables if i["status"] == "open"]
    dso_days = (
        mean(_days_between(i["issue_date"], None) for i in open_rec)
        if open_rec else 0.0
    )
    avg_collection_days = (
        mean(_days_between(i["issue_date"], i.get("paid_date") or i["due_date"]) for i in paid_rec)
        if paid_rec else dso_days
    )

    # DPO — average days to pay suppliers
    paid_pay = [i for i in payables if i["status"] == "paid"]
    open_pay = [i for i in payables if i["status"] == "open"]
    dpo = (
        mean(_days_between(i["issue_date"], i.get("paid_date") or i["due_date"]) for i in paid_pay)
        if paid_pay else (
            mean(_days_between(i["issue_date"]) for i in open_pay) if open_pay else 0.0
        )
    )

    ccc = avg_collection_days - dpo

    # AR / AP totals
    total_ar = sum(i["amount"] for i in open_rec)
    total_ap = sum(i["amount"] for i in open_pay)

    # Overdue > 60 days
    overdue_60 = sum(
        i["amount"] for i in open_rec
        if _days_between(i["due_date"]) > 60
    )

    # Liquidity ratios (approximation from invoice data + cash accounts)
    accounts = store.list_cash_accounts(user["id"])
    cash = sum(a["balance"] for a in accounts if a["account_type"] in ("checking", "savings"))

    ar_30 = sum(i["amount"] for i in open_rec if _days_between(i["due_date"]) <= 30)
    ap_30 = sum(i["amount"] for i in open_pay if _days_between(i["due_date"]) <= 30)
    current_ratio = round((cash + total_ar) / max(total_ap, 1), 2)
    quick_ratio   = round((cash + ar_30) / max(ap_30, 1), 2)

    return {
        "dso_days":              round(avg_collection_days, 1),
        "dpo_days":              round(dpo, 1),
        "cash_conversion_cycle": round(ccc, 1),
        "total_ar":              round(total_ar, 2),
        "total_ap":              round(total_ap, 2),
        "overdue_ar_60d":        round(overdue_60, 2),
        "current_ratio":         current_ratio,
        "quick_ratio":           quick_ratio,
        "open_receivables":      len(open_rec),
        "open_payables":         len(open_pay),
        "health": (
            "strong"   if ccc < 15 and current_ratio > 2
            else "adequate" if ccc < 30 and current_ratio > 1.2
            else "at_risk"
        ),
    }


@router.get("/ar-aging")
def ar_aging(user: dict = Depends(get_current_user)):
    invoices = store.get_all_invoices_for_user(user["id"])
    open_rec = [i for i in invoices if i["kind"] == "receivable" and i["status"] == "open"]

    buckets = {"0_30": [], "31_60": [], "61_90": [], "over_90": []}
    rows = []
    for inv in open_rec:
        days = _days_between(inv["due_date"])
        name = decrypt(inv["counterparty"]) if inv.get("counterparty") else "Unknown"
        bucket = (
            "0_30"    if days <= 30  else
            "31_60"   if days <= 60  else
            "61_90"   if days <= 90  else
            "over_90"
        )
        buckets[bucket].append(inv["amount"])
        rows.append({
            "counterparty": name,
            "amount":        round(inv["amount"], 2),
            "due_date":      inv["due_date"],
            "days_overdue":  round(days, 0),
            "bucket":        bucket,
            "invoice_id":    inv["id"],
        })

    rows.sort(key=lambda r: r["days_overdue"], reverse=True)
    return {
        "rows": rows,
        "summary": {k: {"count": len(v), "total": round(sum(v), 2)} for k, v in buckets.items()},
        "total_overdue": round(sum(sum(v) for k, v in buckets.items() if k != "0_30"), 2),
    }


@router.get("/ap-aging")
def ap_aging(user: dict = Depends(get_current_user)):
    invoices = store.get_all_invoices_for_user(user["id"])
    open_pay = [i for i in invoices if i["kind"] == "payable" and i["status"] == "open"]

    rows = []
    for inv in open_pay:
        days_to_due = _days_between(str(date.today()), inv["due_date"])
        name = decrypt(inv["counterparty"]) if inv.get("counterparty") else "Unknown"
        urgency = "overdue" if days_to_due < 0 else "due_soon" if days_to_due <= 7 else "upcoming"
        rows.append({
            "counterparty": name,
            "amount":        round(inv["amount"], 2),
            "due_date":      inv["due_date"],
            "days_until_due": round(days_to_due, 0),
            "urgency":        urgency,
        })

    rows.sort(key=lambda r: r["days_until_due"])
    return {
        "rows": rows,
        "total_outstanding": round(sum(i["amount"] for i in open_pay), 2),
        "overdue_total":     round(sum(r["amount"] for r in rows if r["urgency"] == "overdue"), 2),
        "due_this_week":     round(sum(r["amount"] for r in rows if r["urgency"] == "due_soon"), 2),
    }
