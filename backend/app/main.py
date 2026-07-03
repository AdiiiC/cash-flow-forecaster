"""FastAPI application entrypoint."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import auth, forecast
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


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/")
def root() -> dict:
    return {"service": "cash-flow-forecaster", "docs": "/docs"}
