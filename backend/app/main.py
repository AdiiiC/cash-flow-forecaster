"""FastAPI application entrypoint."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import auth, forecast, invoices, recurring, scenarios
from app.routers.exim import router as exim_router
from app.routers.mfa import router as mfa_router
from app.routers.org import router as org_router
from app.routers.cashflow_actuals import router as actuals_router_v2
from app.routers.budget import router as budget_router
from app.routers.customers_mrr import router as customers_mrr_router
from app.routers.webhooks_config import router as webhooks_config_router
from app.routers.accounts import router as accounts_router
from app.routers.stress import router as stress_router
from app.routers.scheduled_forecasts import router as scheduled_router
from app.routers.notification_prefs import router as notif_prefs_router
from app.routers.working_capital import router as working_capital_router
from app.routers.burn_rate import router as burn_rate_router, headcount_router
from app.routers.financial_ratios import router as financial_ratios_router
from app.routers.arr_revenue import (
    router as arr_revenue_router,
    booking_router,
    conc_router,
)
from app.routers.capex import router as capex_router
from app.routers.misc_b2b import (
    tax_router, policy_router, financing_router, board_router,
)
from app.actuals.router import router as actuals_router
from app.store import init_db

settings = get_settings()

app = FastAPI(
    title="Cash-Flow-Forecaster API",
    version="0.1.0",
    description="Probabilistic 13-week cash-flow & MRR forecasting with grounded narratives.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_origin_regex=settings.frontend_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Lightweight in-process rate limiting -------------------------------------
# Dependency-free per-IP sliding window on the compute-heavy endpoints. This is
# per-process (fine for a single instance); a distributed limiter (Redis) would
# be the next step when scaling horizontally.
_RATE_MAX = 30  # requests
_RATE_WINDOW = 60.0  # seconds
_RATE_PREFIXES = ("/api/forecast",)
_hits: dict[str, deque[float]] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    path = request.url.path
    if request.method != "OPTIONS" and any(path.startswith(p) for p in _RATE_PREFIXES):
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        bucket = _hits[ip]
        while bucket and now - bucket[0] > _RATE_WINDOW:
            bucket.popleft()
        if len(bucket) >= _RATE_MAX:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests — please slow down and retry shortly."},
            )
        bucket.append(now)
    return await call_next(request)


app.include_router(forecast.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(mfa_router, prefix="/api")
app.include_router(scenarios.router, prefix="/api")
app.include_router(recurring.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(exim_router, prefix="/api")
app.include_router(actuals_router, prefix="/api")
app.include_router(org_router, prefix="/api")
app.include_router(actuals_router_v2, prefix="/api")
app.include_router(budget_router, prefix="/api")
app.include_router(customers_mrr_router, prefix="/api")
app.include_router(webhooks_config_router, prefix="/api")
app.include_router(accounts_router, prefix="/api")
app.include_router(stress_router, prefix="/api")
app.include_router(scheduled_router, prefix="/api")
app.include_router(notif_prefs_router, prefix="/api")
app.include_router(working_capital_router, prefix="/api")
app.include_router(burn_rate_router,       prefix="/api")
app.include_router(headcount_router,       prefix="/api")
app.include_router(financial_ratios_router,prefix="/api")
app.include_router(arr_revenue_router,     prefix="/api")
app.include_router(booking_router,         prefix="/api")
app.include_router(conc_router,            prefix="/api")
app.include_router(capex_router,           prefix="/api")
app.include_router(tax_router,             prefix="/api")
app.include_router(policy_router,          prefix="/api")
app.include_router(financing_router,       prefix="/api")
app.include_router(board_router,           prefix="/api")


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/")
def root() -> dict:
    return {"service": "cash-flow-forecaster", "docs": "/docs"}
