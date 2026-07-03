"""FastAPI application entrypoint."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import forecast
from app.store import init_db

settings = get_settings()

app = FastAPI(
    title="Cash-Flow-Forecaster API",
    version="0.1.0",
    description="Probabilistic 13-week cash-flow & MRR forecasting with grounded narratives.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast.router, prefix="/api")


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/")
def root() -> dict:
    return {"service": "cash-flow-forecaster", "docs": "/docs"}
