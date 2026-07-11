"""ExIm (export/import) foreign-currency invoice endpoints (auth required).

Each invoice stores a predicted FX rate at the due date so expected cashflows
are always expressed in the user's chosen base currency (e.g. INR), with a
p10/p50/p90 band that reflects market volatility over the payment horizon.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app import store
from app.auth import get_current_user
from app.fx_forecast import FxPrediction, predict as fx_predict
from app.schemas import ExImInvoice, ExImInvoiceInput, InvoiceStatus

router = APIRouter(prefix="/exim", tags=["exim"])


class _StatusBody(BaseModel):
    status: InvoiceStatus


def _to_public(row: dict) -> ExImInvoice:
    def _d(v) -> date:
        return v if isinstance(v, date) else date.fromisoformat(v)

    def _dt(v) -> datetime:
        return v if isinstance(v, datetime) else datetime.fromisoformat(v)

    due = _d(row["due_date"])
    overdue = row["status"] == InvoiceStatus.open.value and due < date.today()
    return ExImInvoice(
        id=row["id"],
        kind=row["kind"],
        counterparty=row["counterparty"],
        fcy_code=row["fcy_code"],
        fcy_amount=row["fcy_amount"],
        base_currency=row["base_currency"],
        payment_terms_days=row["payment_terms_days"],
        issue_date=_d(row["issue_date"]),
        due_date=due,
        spot_rate=row["spot_rate"],
        predicted_rate_p50=row["predicted_rate_p50"],
        predicted_rate_p10=row["predicted_rate_p10"],
        predicted_rate_p90=row["predicted_rate_p90"],
        base_amount_p50=row["base_amount_p50"],
        base_amount_p10=row["base_amount_p10"],
        base_amount_p90=row["base_amount_p90"],
        rate_model=row["rate_model"],
        predicted_at=_d(row["predicted_at"]),
        status=row["status"],
        overdue=overdue,
        category=row.get("category"),
        notes=row.get("notes"),
        created_at=_dt(row["created_at"]),
    )


def _safe_predict(fcy: str, base: str, days: int) -> FxPrediction:
    """Run fx_predict; fall back to static rate on any error."""
    try:
        return fx_predict(fcy, base, days)
    except Exception:
        from app import fx as _fx

        try:
            spot = _fx.convert(1.0, fcy, base)
        except Exception:
            spot = 1.0
        return FxPrediction(
            pair=f"{fcy}/{base}",
            horizon_days=days,
            rate_p50=round(spot, 4),
            rate_p10=round(spot * (1 - 0.005), 4),
            rate_p90=round(spot * (1 + 0.005), 4),
            spot_today=round(spot, 4),
            model="static_fallback",
            as_of=date.today(),
        )


@router.get("", response_model=list[ExImInvoice])
def list_exim(user: dict = Depends(get_current_user)) -> list[ExImInvoice]:
    return [_to_public(r) for r in store.list_exim(user["id"])]


@router.post("", response_model=ExImInvoice, status_code=status.HTTP_201_CREATED)
def create_exim(
    body: ExImInvoiceInput, user: dict = Depends(get_current_user)
) -> ExImInvoice:
    pred = _safe_predict(body.fcy_code, body.base_currency, body.payment_terms_days)
    due = body.issue_date + timedelta(days=body.payment_terms_days)

    row = store.save_exim(
        user_id=user["id"],
        kind=body.kind.value,
        counterparty=body.counterparty,
        fcy_code=body.fcy_code,
        fcy_amount=body.fcy_amount,
        base_currency=body.base_currency,
        payment_terms_days=body.payment_terms_days,
        issue_date=body.issue_date.isoformat(),
        due_date=due.isoformat(),
        spot_rate=pred.spot_today,
        predicted_rate_p50=pred.rate_p50,
        predicted_rate_p10=pred.rate_p10,
        predicted_rate_p90=pred.rate_p90,
        base_amount_p50=round(body.fcy_amount * pred.rate_p50, 2),
        base_amount_p10=round(body.fcy_amount * pred.rate_p10, 2),
        base_amount_p90=round(body.fcy_amount * pred.rate_p90, 2),
        rate_model=pred.model,
        predicted_at=pred.as_of.isoformat(),
        status=InvoiceStatus.open.value,
        category=body.category,
        notes=body.notes,
    )
    store.record_audit("exim.create", user_id=user["id"], entity=row["id"])
    return _to_public(row)


@router.patch("/{exim_id}/status", response_model=ExImInvoice)
def update_status(
    exim_id: str,
    body: _StatusBody,
    user: dict = Depends(get_current_user),
) -> ExImInvoice:
    if not store.set_exim_status(exim_id, user["id"], body.status.value):
        raise HTTPException(status_code=404, detail="ExIm invoice not found.")
    store.record_audit(
        "exim.status",
        user_id=user["id"],
        entity=exim_id,
        meta={"status": body.status.value},
    )
    row = store.get_exim(exim_id, user["id"])
    return _to_public(row)


@router.delete("/{exim_id}")
def delete_exim(
    exim_id: str, user: dict = Depends(get_current_user)
) -> dict:
    if not store.delete_exim(exim_id, user["id"]):
        raise HTTPException(status_code=404, detail="ExIm invoice not found.")
    store.record_audit("exim.delete", user_id=user["id"], entity=exim_id)
    return {"deleted": exim_id}


@router.get("/fx/predict")
def fx_predict_endpoint(
    base: str = Query(..., min_length=3, max_length=8),
    quote: str = Query(..., min_length=3, max_length=8),
    days: int = Query(..., ge=1, le=3650),
    _user: dict = Depends(get_current_user),
) -> dict:
    """Standalone FX rate prediction — useful for quoting before creating an invoice."""
    pred = _safe_predict(base, quote, days)
    return {
        "pair": pred.pair,
        "horizon_days": pred.horizon_days,
        "rate_p50": pred.rate_p50,
        "rate_p10": pred.rate_p10,
        "rate_p90": pred.rate_p90,
        "spot_today": pred.spot_today,
        "model": pred.model,
        "as_of": pred.as_of.isoformat(),
    }
