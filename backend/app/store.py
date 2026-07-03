"""Run history persistence via stdlib sqlite3 (no extra dependency).

Each completed forecast is saved so the UI can show a history sidebar and let
the user reopen a past run. The full response payload is stored as JSON so a
run can be rehydrated exactly.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime
from pathlib import Path

from app.schemas import ForecastResponse, RunSummary

_DB_PATH = Path(__file__).resolve().parent.parent / "runs.db"
_LOCK = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _LOCK, _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                source TEXT NOT NULL,
                currency TEXT NOT NULL,
                horizon_weeks INTEGER NOT NULL,
                opening_balance REAL NOT NULL,
                projected_balance_p50 REAL NOT NULL,
                runway_weeks REAL,
                label TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )


def save_run(response: ForecastResponse, source: str, label: str) -> str:
    run_id = uuid.uuid4().hex[:12]
    with _LOCK, _connect() as conn:
        conn.execute(
            """
            INSERT INTO runs (id, created_at, source, currency, horizon_weeks,
                              opening_balance, projected_balance_p50, runway_weeks, label, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                datetime.utcnow().isoformat(),
                source,
                response.currency,
                response.horizon_weeks,
                response.opening_balance,
                response.projected_balance_p50,
                response.runway_weeks,
                label,
                response.model_dump_json(),
            ),
        )
    return run_id


def list_runs(limit: int = 25) -> list[RunSummary]:
    with _LOCK, _connect() as conn:
        rows = conn.execute(
            "SELECT id, created_at, source, currency, horizon_weeks, opening_balance, "
            "projected_balance_p50, runway_weeks, label "
            "FROM runs ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
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
    with _LOCK, _connect() as conn:
        row = conn.execute("SELECT payload FROM runs WHERE id = ?", (run_id,)).fetchone()
    if row is None:
        return None
    return ForecastResponse.model_validate(json.loads(row["payload"]))


# Ensure the schema exists as soon as this module is imported, so a request that
# arrives before the FastAPI startup hook (or after the db file is removed) still
# finds the table. CREATE TABLE IF NOT EXISTS makes this safe to run repeatedly.
init_db()
