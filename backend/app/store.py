"""Run history persistence via SQLAlchemy.

Each completed forecast is saved so the UI can show a history sidebar and let
the user reopen a past run. The full response payload is stored as JSON so a
run can be rehydrated exactly.

Backend selection is automatic:
  * DATABASE_URL set  -> that database (e.g. Supabase/Neon Postgres). Runs then
    survive restarts and cold starts.
  * DATABASE_URL empty -> a local SQLite file, so dev and tests need zero setup.
"""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    delete,
    insert,
    select,
)
from sqlalchemy.engine import Engine

from app.config import get_settings
from app.schemas import ForecastResponse, RunSummary

_SQLITE_PATH = Path(__file__).resolve().parent.parent / "runs.db"
_LOCK = threading.Lock()
_INITIALIZED = False
_ENGINE: Engine | None = None

_metadata = MetaData()
_runs = Table(
    "runs",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("created_at", String(40), nullable=False),
    Column("source", String(32), nullable=False),
    Column("currency", String(8), nullable=False),
    Column("horizon_weeks", Integer, nullable=False),
    Column("opening_balance", Float, nullable=False),
    Column("projected_balance_p50", Float, nullable=False),
    Column("runway_weeks", Float, nullable=True),
    Column("label", String(200), nullable=False),
    Column("payload", Text, nullable=False),
)


def _resolve_url() -> str:
    """Pick the connection URL and normalise it for the psycopg 3 driver."""
    url = get_settings().database_url.strip()
    if not url:
        return f"sqlite:///{_SQLITE_PATH}"
    # SQLAlchemy needs the explicit driver; Supabase/Neon hand out bare
    # postgres:// or postgresql:// URLs.
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def _engine() -> Engine:
    global _ENGINE
    if _ENGINE is None:
        url = _resolve_url()
        if url.startswith("sqlite"):
            _ENGINE = create_engine(url, future=True)
        else:
            # pre_ping recovers from connections the Supabase pooler has dropped;
            # a small pool keeps us well under the free-tier connection cap.
            _ENGINE = create_engine(
                url, future=True, pool_pre_ping=True, pool_size=5, max_overflow=2
            )
    return _ENGINE


def init_db() -> None:
    _metadata.create_all(_engine())


def _ensure() -> None:
    """Create the schema on first use (idempotent, thread-safe, no import side effect)."""
    global _INITIALIZED
    if _INITIALIZED:
        return
    with _LOCK:
        if not _INITIALIZED:
            init_db()
            _INITIALIZED = True


def save_run(response: ForecastResponse, source: str, label: str) -> str:
    _ensure()
    run_id = uuid.uuid4().hex[:12]
    with _engine().begin() as conn:
        conn.execute(
            insert(_runs).values(
                id=run_id,
                created_at=datetime.utcnow().isoformat(),
                source=source,
                currency=response.currency,
                horizon_weeks=response.horizon_weeks,
                opening_balance=response.opening_balance,
                projected_balance_p50=response.projected_balance_p50,
                runway_weeks=response.runway_weeks,
                label=label,
                payload=response.model_dump_json(),
            )
        )
    return run_id


def list_runs(limit: int = 25) -> list[RunSummary]:
    _ensure()
    stmt = (
        select(
            _runs.c.id,
            _runs.c.created_at,
            _runs.c.source,
            _runs.c.currency,
            _runs.c.horizon_weeks,
            _runs.c.opening_balance,
            _runs.c.projected_balance_p50,
            _runs.c.runway_weeks,
            _runs.c.label,
        )
        .order_by(_runs.c.created_at.desc())
        .limit(limit)
    )
    with _engine().connect() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [
        RunSummary(
            id=r["id"],
            created_at=datetime.fromisoformat(r["created_at"]),
            source=r["source"],
            currency=r["currency"],
            horizon_weeks=r["horizon_weeks"],
            opening_balance=r["opening_balance"],
            projected_balance_p50=r["projected_balance_p50"],
            runway_weeks=r["runway_weeks"],
            label=r["label"],
        )
        for r in rows
    ]


def get_run(run_id: str) -> ForecastResponse | None:
    _ensure()
    stmt = select(_runs.c.payload).where(_runs.c.id == run_id)
    with _engine().connect() as conn:
        row = conn.execute(stmt).first()
    if row is None:
        return None
    return ForecastResponse.model_validate(json.loads(row[0]))


def clear_runs() -> int:
    """Delete all saved runs. Returns the number of rows removed."""
    _ensure()
    with _engine().begin() as conn:
        result = conn.execute(delete(_runs))
        return result.rowcount if result.rowcount is not None else 0
