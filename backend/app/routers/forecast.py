"""Forecast + data + operational endpoints."""
from __future__ import annotations

import json
import queue
import threading

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse, StreamingResponse

from app import fx as fx_mod
from app import store
from app.config import get_settings
from app.data.ingest import IngestError, parse_csv
from app.data.synthetic import generate_ledger
from app.llm import provider
from app.schemas import (
    ForecastResponse,
    FxRates,
    Ledger,
    RunSummary,
    SyntheticRequest,
    Thresholds,
)
from app.service import build_forecast

router = APIRouter()


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    active = provider.describe()
    db = "postgres" if store._resolve_url().startswith("postgresql") else "sqlite"
    return {
        "status": "ok",
        "llm_enabled": settings.llm_enabled,
        "provider": active["provider"],
        "model": active["model"],
        "db": db,
    }


@router.post("/forecast/demo", response_model=ForecastResponse)
def forecast_demo(req: SyntheticRequest) -> ForecastResponse:
    """Generate a synthetic SaaS ledger and forecast it (self-contained demo)."""
    ledger = generate_ledger(
        weeks=req.weeks,
        seed=req.seed,
        starting_mrr=req.starting_mrr,
        opening_balance=req.opening_balance,
        currency=req.currency,
    )
    return build_forecast(
        ledger,
        source="demo",
        thresholds=req.thresholds,
        scenario=req.scenario,
    )


@router.get("/forecast/demo/stream")
def forecast_demo_stream(
    weeks: int = Query(104, ge=26, le=520),
    seed: int = 42,
    starting_mrr: float = Query(80_000.0, gt=0),
    opening_balance: float = 250_000.0,
    currency: str = "USD",
    min_balance: float | None = None,
    min_runway_weeks: float | None = None,
) -> StreamingResponse:
    """Server-Sent Events: emit progress while the (potentially ~20s) forecast runs.

    Frames: ``event: progress`` with {fraction,message}, then ``event: result``
    with the full ForecastResponse JSON, then ``event: done``.
    """
    try:
        req = SyntheticRequest(
            weeks=weeks,
            seed=seed,
            starting_mrr=starting_mrr,
            opening_balance=opening_balance,
            currency=currency,
        )
    except Exception as exc:  # noqa: BLE001 - surface validation as a stream error
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    thresholds = Thresholds(min_balance=min_balance, min_runway_weeks=min_runway_weeks)
    q: "queue.Queue[tuple[str, object]]" = queue.Queue()

    def on_progress(fraction: float, message: str) -> None:
        q.put(("progress", {"fraction": round(fraction, 3), "message": message}))

    def worker() -> None:
        try:
            ledger = generate_ledger(
                weeks=req.weeks,
                seed=req.seed,
                starting_mrr=req.starting_mrr,
                opening_balance=req.opening_balance,
                currency=req.currency,
            )
            result = build_forecast(
                ledger, source="demo", thresholds=thresholds, progress=on_progress
            )
            q.put(("result", result.model_dump(mode="json")))
        except Exception as exc:  # noqa: BLE001 - forward failure to the client
            q.put(("error", {"detail": str(exc)}))
        finally:
            q.put(("__end__", None))

    def event_stream():
        threading.Thread(target=worker, daemon=True).start()
        while True:
            kind, payload = q.get()
            if kind == "__end__":
                yield "event: done\ndata: {}\n\n"
                break
            yield f"event: {kind}\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/forecast", response_model=ForecastResponse)
def forecast_ledger(ledger: Ledger) -> ForecastResponse:
    """Forecast a caller-supplied structured ledger."""
    return build_forecast(ledger, source="ledger")


@router.post("/forecast/upload", response_model=ForecastResponse)
async def forecast_upload(
    file: UploadFile = File(...),
    opening_balance: float = 0.0,
    currency: str = "USD",
) -> ForecastResponse:
    """Upload a CSV of transactions and forecast it."""
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")
    # Cap the read so a huge upload can't exhaust memory before we validate it.
    max_bytes = 5 * 1024 * 1024
    raw = await file.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large: max 5 MB.")
    try:
        ledger = parse_csv(raw, opening_balance=opening_balance, currency=currency)
    except IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return build_forecast(ledger, source="upload", label=file.filename or "upload")


# ---- Run history (persistence) -------------------------------------------------


@router.get("/runs", response_model=list[RunSummary])
def list_runs(limit: int = Query(25, ge=1, le=100)) -> list[RunSummary]:
    return store.list_runs(limit=limit)


@router.delete("/runs")
def clear_runs() -> dict:
    """Delete all saved runs from history."""
    deleted = store.clear_runs()
    return {"deleted": deleted}


@router.get("/runs/{run_id}", response_model=ForecastResponse)
def get_run(run_id: str) -> ForecastResponse:
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    return run


@router.get("/runs/{run_id}/export.csv")
def export_run_csv(run_id: str) -> PlainTextResponse:
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    csv_text = _forecast_to_csv(run)
    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="forecast_{run_id}.csv"'},
    )


def _forecast_to_csv(run: ForecastResponse) -> str:
    lines = ["series,period,p10,p50,p90,unit"]
    for s in run.series:
        for p in s.forecast:
            lines.append(f"{s.name},{p.period},{p.p10},{p.p50},{p.p90},{s.unit}")
    return "\n".join(lines) + "\n"


# ---- FX ------------------------------------------------------------------------


@router.get("/fx", response_model=FxRates)
def fx_rates() -> FxRates:
    return fx_mod.get_rates()
