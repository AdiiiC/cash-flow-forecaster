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
    inspect,
    select,
    text,
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
    # Nullable so anonymous demo runs still persist; owned runs carry a user id.
    Column("user_id", String(32), nullable=True),
)

_users = Table(
    "users",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("email", String(254), nullable=False, unique=True),
    Column("password_hash", String(200), nullable=False),
    Column("created_at", String(40), nullable=False),
)

_scenarios = Table(
    "scenarios",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("name", String(120), nullable=False),
    Column("payload", Text, nullable=False),  # ScenarioInput as JSON
    Column("created_at", String(40), nullable=False),
)

_audit_log = Table(
    "audit_log",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=True),  # null for anonymous/system events
    Column("action", String(64), nullable=False),  # e.g. "auth.login", "scenario.create"
    Column("entity", String(120), nullable=True),  # optional target id/label
    Column("meta", Text, nullable=True),  # optional JSON details
    Column("created_at", String(40), nullable=False),
)

_recurring = Table(
    "recurring_items",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("name", String(120), nullable=False),
    Column("amount", Float, nullable=False),
    Column("direction", String(16), nullable=False),  # inflow | outflow
    Column("cadence", String(16), nullable=False),  # weekly | biweekly | monthly | quarterly
    Column("anchor_date", String(20), nullable=False),  # ISO date of next/first occurrence
    Column("category", String(60), nullable=True),
    Column("active", Integer, nullable=False, default=1),
    Column("created_at", String(40), nullable=False),
)

_invoices = Table(
    "invoices",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("kind", String(16), nullable=False),  # receivable | payable
    Column("counterparty", Text, nullable=False),  # encrypted at rest
    Column("amount", Float, nullable=False),
    Column("issue_date", String(20), nullable=False),  # ISO
    Column("due_date", String(20), nullable=False),  # ISO
    Column("status", String(16), nullable=False, default="open"),  # open | paid | void
    Column("category", String(60), nullable=True),
    Column("created_at", String(40), nullable=False),
)

_exim_invoices = Table(
    "exim_invoices",
    _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("kind", String(16), nullable=False),         # receivable | payable
    Column("counterparty", Text, nullable=False),       # encrypted at rest
    Column("fcy_code", String(8), nullable=False),      # foreign currency code
    Column("fcy_amount", Float, nullable=False),        # amount in foreign currency
    Column("base_currency", String(8), nullable=False), # reporting currency
    Column("payment_terms_days", Integer, nullable=False),
    Column("issue_date", String(20), nullable=False),
    Column("due_date", String(20), nullable=False),
    Column("spot_rate", Float, nullable=False),
    Column("predicted_rate_p50", Float, nullable=False),
    Column("predicted_rate_p10", Float, nullable=False),
    Column("predicted_rate_p90", Float, nullable=False),
    Column("base_amount_p50", Float, nullable=False),
    Column("base_amount_p10", Float, nullable=False),
    Column("base_amount_p90", Float, nullable=False),
    Column("rate_model", String(60), nullable=False),
    Column("predicted_at", String(20), nullable=False),
    Column("status", String(16), nullable=False),
    Column("category", String(60), nullable=True),
    Column("notes", Text, nullable=True),
    Column("created_at", String(40), nullable=False),
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
    engine = _engine()
    _metadata.create_all(engine)
    # Lightweight forward-migration: older `runs` tables (created before auth)
    # lack user_id. ADD COLUMN is supported by both SQLite and Postgres and is a
    # no-op once the column exists.
    existing = {c["name"] for c in inspect(engine).get_columns("runs")}
    if "user_id" not in existing:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE runs ADD COLUMN user_id VARCHAR(32)"))


def _ensure() -> None:
    """Create the schema on first use (idempotent, thread-safe, no import side effect)."""
    global _INITIALIZED
    if _INITIALIZED:
        return
    with _LOCK:
        if not _INITIALIZED:
            init_db()
            _INITIALIZED = True


def save_run(
    response: ForecastResponse,
    source: str,
    label: str,
    user_id: str | None = None,
) -> str:
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
                user_id=user_id,
            )
        )
    return run_id


def list_runs(limit: int = 25, user_id: str | None = None) -> list[RunSummary]:
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
        .where(_runs.c.user_id == user_id if user_id else _runs.c.user_id.is_(None))
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


def get_run(run_id: str, user_id: str | None = None) -> ForecastResponse | None:
    _ensure()
    owner = _runs.c.user_id == user_id if user_id else _runs.c.user_id.is_(None)
    stmt = select(_runs.c.payload).where(_runs.c.id == run_id, owner)
    with _engine().connect() as conn:
        row = conn.execute(stmt).first()
    if row is None:
        return None
    return ForecastResponse.model_validate(json.loads(row[0]))


def clear_runs(user_id: str | None = None) -> int:
    """Delete saved runs for the given owner. Returns the number of rows removed."""
    _ensure()
    owner = _runs.c.user_id == user_id if user_id else _runs.c.user_id.is_(None)
    with _engine().begin() as conn:
        result = conn.execute(delete(_runs).where(owner))
        return result.rowcount if result.rowcount is not None else 0


# ---- Users --------------------------------------------------------------------


def create_user(email: str, password_hash: str) -> dict:
    """Insert a new user. Raises if the email already exists (unique constraint)."""
    _ensure()
    user_id = uuid.uuid4().hex[:12]
    created_at = datetime.utcnow().isoformat()
    with _engine().begin() as conn:
        conn.execute(
            insert(_users).values(
                id=user_id,
                email=email,
                password_hash=password_hash,
                created_at=created_at,
            )
        )
    return {"id": user_id, "email": email, "created_at": created_at}


def get_user_by_email(email: str) -> dict | None:
    _ensure()
    stmt = select(
        _users.c.id, _users.c.email, _users.c.password_hash, _users.c.created_at
    ).where(_users.c.email == email)
    with _engine().connect() as conn:
        row = conn.execute(stmt).mappings().first()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict | None:
    _ensure()
    stmt = select(
        _users.c.id, _users.c.email, _users.c.password_hash, _users.c.created_at
    ).where(_users.c.id == user_id)
    with _engine().connect() as conn:
        row = conn.execute(stmt).mappings().first()
    return dict(row) if row else None


# ---- Saved scenarios ----------------------------------------------------------


def save_scenario(user_id: str, name: str, scenario_json: str) -> dict:
    """Persist a named what-if preset for a user. Returns the stored record."""
    _ensure()
    scenario_id = uuid.uuid4().hex[:12]
    created_at = datetime.utcnow().isoformat()
    with _engine().begin() as conn:
        conn.execute(
            insert(_scenarios).values(
                id=scenario_id,
                user_id=user_id,
                name=name,
                payload=scenario_json,
                created_at=created_at,
            )
        )
    return {"id": scenario_id, "name": name, "payload": scenario_json, "created_at": created_at}


def list_scenarios(user_id: str) -> list[dict]:
    _ensure()
    stmt = (
        select(
            _scenarios.c.id,
            _scenarios.c.name,
            _scenarios.c.payload,
            _scenarios.c.created_at,
        )
        .where(_scenarios.c.user_id == user_id)
        .order_by(_scenarios.c.created_at.desc())
    )
    with _engine().connect() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [dict(r) for r in rows]


def delete_scenario(scenario_id: str, user_id: str) -> bool:
    """Delete a user's saved scenario. Returns True if a row was removed."""
    _ensure()
    with _engine().begin() as conn:
        result = conn.execute(
            delete(_scenarios).where(
                _scenarios.c.id == scenario_id, _scenarios.c.user_id == user_id
            )
        )
    return bool(result.rowcount)


# ---- Audit log ----------------------------------------------------------------


def record_audit(
    action: str,
    user_id: str | None = None,
    entity: str | None = None,
    meta: dict | None = None,
) -> None:
    """Append an audit event. Never raises — auditing must not break a request."""
    try:
        _ensure()
        with _engine().begin() as conn:
            conn.execute(
                insert(_audit_log).values(
                    id=uuid.uuid4().hex[:12],
                    user_id=user_id,
                    action=action,
                    entity=entity,
                    meta=json.dumps(meta) if meta is not None else None,
                    created_at=datetime.utcnow().isoformat(),
                )
            )
    except Exception:  # noqa: BLE001 - auditing is best-effort
        pass


def list_audit(user_id: str, limit: int = 100) -> list[dict]:
    _ensure()
    stmt = (
        select(
            _audit_log.c.id,
            _audit_log.c.action,
            _audit_log.c.entity,
            _audit_log.c.meta,
            _audit_log.c.created_at,
        )
        .where(_audit_log.c.user_id == user_id)
        .order_by(_audit_log.c.created_at.desc())
        .limit(limit)
    )
    with _engine().connect() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [dict(r) for r in rows]


# ---- Recurring scheduled items ------------------------------------------------


def _recurring_to_dict(row) -> dict:
    d = dict(row)
    d["active"] = bool(d["active"])
    return d


def save_recurring(
    user_id: str,
    *,
    name: str,
    amount: float,
    direction: str,
    cadence: str,
    anchor_date: str,
    category: str | None,
    active: bool = True,
) -> dict:
    _ensure()
    item_id = uuid.uuid4().hex[:12]
    created_at = datetime.utcnow().isoformat()
    with _engine().begin() as conn:
        conn.execute(
            insert(_recurring).values(
                id=item_id,
                user_id=user_id,
                name=name,
                amount=amount,
                direction=direction,
                cadence=cadence,
                anchor_date=anchor_date,
                category=category,
                active=1 if active else 0,
                created_at=created_at,
            )
        )
    return get_recurring(item_id, user_id)


def get_recurring(item_id: str, user_id: str) -> dict | None:
    _ensure()
    stmt = select(_recurring).where(
        _recurring.c.id == item_id, _recurring.c.user_id == user_id
    )
    with _engine().connect() as conn:
        row = conn.execute(stmt).mappings().first()
    return _recurring_to_dict(row) if row else None


def list_recurring(user_id: str, *, active_only: bool = False) -> list[dict]:
    _ensure()
    stmt = select(_recurring).where(_recurring.c.user_id == user_id)
    if active_only:
        stmt = stmt.where(_recurring.c.active == 1)
    stmt = stmt.order_by(_recurring.c.anchor_date.asc())
    with _engine().connect() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [_recurring_to_dict(r) for r in rows]


def delete_recurring(item_id: str, user_id: str) -> bool:
    _ensure()
    with _engine().begin() as conn:
        result = conn.execute(
            delete(_recurring).where(
                _recurring.c.id == item_id, _recurring.c.user_id == user_id
            )
        )
    return bool(result.rowcount)


# ---- Invoices & bills (AR / AP) -----------------------------------------------


def _invoice_to_dict(row) -> dict:
    from app.security import crypto

    d = dict(row)
    d["counterparty"] = crypto.decrypt(d["counterparty"])
    return d


def save_invoice(
    user_id: str,
    *,
    kind: str,
    counterparty: str,
    amount: float,
    issue_date: str,
    due_date: str,
    status: str,
    category: str | None,
) -> dict:
    from app.security import crypto

    _ensure()
    inv_id = uuid.uuid4().hex[:12]
    created_at = datetime.utcnow().isoformat()
    with _engine().begin() as conn:
        conn.execute(
            insert(_invoices).values(
                id=inv_id,
                user_id=user_id,
                kind=kind,
                counterparty=crypto.encrypt(counterparty),
                amount=amount,
                issue_date=issue_date,
                due_date=due_date,
                status=status,
                category=category,
                created_at=created_at,
            )
        )
    return get_invoice(inv_id, user_id)


def get_invoice(invoice_id: str, user_id: str) -> dict | None:
    _ensure()
    stmt = select(_invoices).where(
        _invoices.c.id == invoice_id, _invoices.c.user_id == user_id
    )
    with _engine().connect() as conn:
        row = conn.execute(stmt).mappings().first()
    return _invoice_to_dict(row) if row else None


def list_invoices(user_id: str, *, open_only: bool = False) -> list[dict]:
    _ensure()
    stmt = select(_invoices).where(_invoices.c.user_id == user_id)
    if open_only:
        stmt = stmt.where(_invoices.c.status == "open")
    stmt = stmt.order_by(_invoices.c.due_date.asc())
    with _engine().connect() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [_invoice_to_dict(r) for r in rows]


def set_invoice_status(invoice_id: str, user_id: str, status: str) -> bool:
    _ensure()
    with _engine().begin() as conn:
        result = conn.execute(
            _invoices.update()
            .where(_invoices.c.id == invoice_id, _invoices.c.user_id == user_id)
            .values(status=status)
        )
    return bool(result.rowcount)


def delete_invoice(invoice_id: str, user_id: str) -> bool:
    _ensure()
    with _engine().begin() as conn:
        result = conn.execute(
            delete(_invoices).where(
                _invoices.c.id == invoice_id, _invoices.c.user_id == user_id
            )
        )
    return bool(result.rowcount)


# ---- ExIm (export/import) foreign-currency invoices -------------------------


def _exim_to_dict(row) -> dict:
    from app.security import crypto

    d = dict(row)
    d["counterparty"] = crypto.decrypt(d["counterparty"])
    return d


def save_exim(
    user_id: str,
    *,
    kind: str,
    counterparty: str,
    fcy_code: str,
    fcy_amount: float,
    base_currency: str,
    payment_terms_days: int,
    issue_date: str,
    due_date: str,
    spot_rate: float,
    predicted_rate_p50: float,
    predicted_rate_p10: float,
    predicted_rate_p90: float,
    base_amount_p50: float,
    base_amount_p10: float,
    base_amount_p90: float,
    rate_model: str,
    predicted_at: str,
    status: str,
    category: str | None,
    notes: str | None,
) -> dict:
    from app.security import crypto

    _ensure()
    exim_id = uuid.uuid4().hex[:12]
    created_at = datetime.utcnow().isoformat()
    with _engine().begin() as conn:
        conn.execute(
            insert(_exim_invoices).values(
                id=exim_id,
                user_id=user_id,
                kind=kind,
                counterparty=crypto.encrypt(counterparty),
                fcy_code=fcy_code,
                fcy_amount=fcy_amount,
                base_currency=base_currency,
                payment_terms_days=payment_terms_days,
                issue_date=issue_date,
                due_date=due_date,
                spot_rate=spot_rate,
                predicted_rate_p50=predicted_rate_p50,
                predicted_rate_p10=predicted_rate_p10,
                predicted_rate_p90=predicted_rate_p90,
                base_amount_p50=base_amount_p50,
                base_amount_p10=base_amount_p10,
                base_amount_p90=base_amount_p90,
                rate_model=rate_model,
                predicted_at=predicted_at,
                status=status,
                category=category,
                notes=notes,
                created_at=created_at,
            )
        )
    return get_exim(exim_id, user_id)


def get_exim(exim_id: str, user_id: str) -> dict | None:
    _ensure()
    stmt = select(_exim_invoices).where(
        _exim_invoices.c.id == exim_id,
        _exim_invoices.c.user_id == user_id,
    )
    with _engine().connect() as conn:
        row = conn.execute(stmt).mappings().first()
    return _exim_to_dict(row) if row else None


def list_exim(user_id: str, *, open_only: bool = False) -> list[dict]:
    _ensure()
    stmt = select(_exim_invoices).where(_exim_invoices.c.user_id == user_id)
    if open_only:
        stmt = stmt.where(_exim_invoices.c.status == "open")
    stmt = stmt.order_by(_exim_invoices.c.due_date.asc())
    with _engine().connect() as conn:
        rows = conn.execute(stmt).mappings().all()
    return [_exim_to_dict(r) for r in rows]


def set_exim_status(exim_id: str, user_id: str, status: str) -> bool:
    _ensure()
    with _engine().begin() as conn:
        result = conn.execute(
            _exim_invoices.update()
            .where(
                _exim_invoices.c.id == exim_id,
                _exim_invoices.c.user_id == user_id,
            )
            .values(status=status)
        )
    return bool(result.rowcount)


def delete_exim(exim_id: str, user_id: str) -> bool:
    _ensure()
    with _engine().begin() as conn:
        result = conn.execute(
            delete(_exim_invoices).where(
                _exim_invoices.c.id == exim_id,
                _exim_invoices.c.user_id == user_id,
            )
        )
    return bool(result.rowcount)


# ══════════════════════════════════════════════════════════════════════════════
# New B2B tables — appended; same _metadata so create_all() picks them up.
# ══════════════════════════════════════════════════════════════════════════════

_user_mfa = Table(
    "user_mfa", _metadata,
    Column("user_id", String(32), primary_key=True),
    Column("totp_secret", Text, nullable=True),
    Column("totp_enabled", Integer, nullable=False, default=0),
    Column("email_otp_enabled", Integer, nullable=False, default=0),
    Column("backup_codes", Text, nullable=True),
    Column("created_at", String(40), nullable=False),
    Column("updated_at", String(40), nullable=False),
)

_otp_codes = Table(
    "otp_codes", _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("code_hash", String(200), nullable=False),
    Column("expires_at", String(40), nullable=False),
    Column("used", Integer, nullable=False, default=0),
    Column("created_at", String(40), nullable=False),
)

_organizations = Table(
    "organizations", _metadata,
    Column("id", String(32), primary_key=True),
    Column("name", String(200), nullable=False),
    Column("plan", String(32), nullable=False, default="free"),
    Column("fiscal_year_start_month", Integer, nullable=False, default=1),
    Column("default_currency", String(8), nullable=False, default="USD"),
    Column("created_by", String(32), nullable=True),
    Column("created_at", String(40), nullable=False),
)

_org_members = Table(
    "org_members", _metadata,
    Column("id", String(32), primary_key=True),
    Column("org_id", String(32), nullable=False),
    Column("user_id", String(32), nullable=False),
    Column("role", String(32), nullable=False, default="member"),
    Column("invited_by", String(32), nullable=True),
    Column("status", String(32), nullable=False, default="active"),
    Column("joined_at", String(40), nullable=False),
)

_org_invites = Table(
    "org_invites", _metadata,
    Column("id", String(32), primary_key=True),
    Column("org_id", String(32), nullable=False),
    Column("email", String(254), nullable=False),
    Column("role", String(32), nullable=False, default="member"),
    Column("token_hash", String(200), nullable=False),
    Column("invited_by", String(32), nullable=False),
    Column("expires_at", String(40), nullable=False),
    Column("accepted", Integer, nullable=False, default=0),
    Column("created_at", String(40), nullable=False),
)

_cashflow_actuals = Table(
    "cashflow_actuals", _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("org_id", String(32), nullable=True),
    Column("week_start", String(20), nullable=False),
    Column("category", String(60), nullable=False),
    Column("direction", String(16), nullable=False),
    Column("amount", Float, nullable=False),
    Column("source", String(32), nullable=False, default="manual"),
    Column("notes", Text, nullable=True),
    Column("created_at", String(40), nullable=False),
)

_budgets = Table(
    "budgets", _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("org_id", String(32), nullable=True),
    Column("fiscal_year", Integer, nullable=False),
    Column("category", String(60), nullable=False),
    Column("direction", String(16), nullable=False),
    Column("weekly_amount", Float, nullable=False),
    Column("label", String(200), nullable=True),
    Column("created_at", String(40), nullable=False),
)

_customers_mrr = Table(
    "customers_mrr", _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("org_id", String(32), nullable=True),
    Column("name", Text, nullable=False),
    Column("arr", Float, nullable=False, default=0.0),
    Column("contract_start", String(20), nullable=True),
    Column("contract_end", String(20), nullable=True),
    Column("renewal_probability", Float, nullable=False, default=0.8),
    Column("status", String(32), nullable=False, default="active"),
    Column("billing_cycle", String(32), nullable=False, default="monthly"),
    Column("created_at", String(40), nullable=False),
)

_webhooks_cfg = Table(
    "webhooks_cfg", _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("org_id", String(32), nullable=True),
    Column("url", String(500), nullable=False),
    Column("events", Text, nullable=False),
    Column("secret", String(128), nullable=False),
    Column("active", Integer, nullable=False, default=1),
    Column("created_at", String(40), nullable=False),
)

_webhook_deliveries = Table(
    "webhook_deliveries", _metadata,
    Column("id", String(32), primary_key=True),
    Column("webhook_id", String(32), nullable=False),
    Column("event", String(64), nullable=False),
    Column("payload_preview", Text, nullable=True),
    Column("status_code", Integer, nullable=True),
    Column("error", Text, nullable=True),
    Column("attempted_at", String(40), nullable=False),
    Column("next_retry_at", String(40), nullable=True),
    Column("attempt_count", Integer, nullable=False, default=1),
    Column("success", Integer, nullable=False, default=0),
)

_cash_accounts = Table(
    "cash_accounts", _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("org_id", String(32), nullable=True),
    Column("name", String(200), nullable=False),
    Column("account_type", String(32), nullable=False, default="checking"),
    Column("balance", Float, nullable=False, default=0.0),
    Column("credit_limit", Float, nullable=True),
    Column("currency", String(8), nullable=False, default="USD"),
    Column("as_of", String(20), nullable=True),
    Column("created_at", String(40), nullable=False),
)

_scheduled_forecasts = Table(
    "scheduled_forecasts", _metadata,
    Column("id", String(32), primary_key=True),
    Column("user_id", String(32), nullable=False),
    Column("org_id", String(32), nullable=True),
    Column("label", String(200), nullable=False),
    Column("cadence", String(32), nullable=False, default="weekly"),
    Column("day_of_week", Integer, nullable=False, default=1),
    Column("config_json", Text, nullable=False),
    Column("active", Integer, nullable=False, default=1),
    Column("last_run_at", String(40), nullable=True),
    Column("next_run_at", String(40), nullable=True),
    Column("created_at", String(40), nullable=False),
)

_notification_prefs = Table(
    "notification_prefs", _metadata,
    Column("user_id", String(32), primary_key=True),
    Column("email_digest_enabled", Integer, nullable=False, default=1),
    Column("digest_cadence", String(32), nullable=False, default="weekly"),
    Column("digest_day", Integer, nullable=False, default=1),
    Column("slack_enabled", Integer, nullable=False, default=1),
    Column("webhook_enabled", Integer, nullable=False, default=1),
    Column("updated_at", String(40), nullable=False),
)

# ── Store helper functions for new tables ──────────────────────────────────────

def _row(result) -> dict | None:
    row = result.fetchone()
    return dict(row._mapping) if row else None


def _rows(result) -> list[dict]:
    return [dict(r._mapping) for r in result.fetchall()]


# MFA
def get_user_mfa(user_id: str) -> dict | None:
    _ensure()
    with _engine().connect() as conn:
        return _row(conn.execute(select(_user_mfa).where(_user_mfa.c.user_id == user_id)))


def upsert_user_mfa(user_id: str, fields: dict) -> None:
    _ensure()
    with _engine().begin() as conn:
        existing = _row(conn.execute(select(_user_mfa).where(_user_mfa.c.user_id == user_id)))
        if existing:
            from sqlalchemy import update
            conn.execute(update(_user_mfa).where(_user_mfa.c.user_id == user_id).values(**fields))
        else:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(insert(_user_mfa).values(user_id=user_id, created_at=now,
                                                   updated_at=now, **fields))


# OTP codes
def save_otp_code(id: str, user_id: str, code_hash: str, expires_at: str) -> None:
    _ensure()
    from datetime import datetime, timezone
    with _engine().begin() as conn:
        conn.execute(insert(_otp_codes).values(
            id=id, user_id=user_id, code_hash=code_hash,
            expires_at=expires_at, used=0,
            created_at=datetime.now(timezone.utc).isoformat(),
        ))


def get_latest_otp_code(user_id: str) -> dict | None:
    _ensure()
    with _engine().connect() as conn:
        result = conn.execute(
            select(_otp_codes).where(_otp_codes.c.user_id == user_id)
            .order_by(_otp_codes.c.created_at.desc()).limit(1)
        )
        return _row(result)


def mark_otp_used(otp_id: str) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(update(_otp_codes).where(_otp_codes.c.id == otp_id).values(used=1))


# Organisations
def create_organisation(org_id: str, name: str, fiscal_year_start_month: int,
                         default_currency: str, created_by: str, created_at: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(insert(_organizations).values(
            id=org_id, name=name,
            fiscal_year_start_month=fiscal_year_start_month,
            default_currency=default_currency,
            created_by=created_by, created_at=created_at,
        ))


def get_organisation(org_id: str) -> dict | None:
    _ensure()
    with _engine().connect() as conn:
        return _row(conn.execute(select(_organizations).where(_organizations.c.id == org_id)))


def get_org_membership(user_id: str) -> dict | None:
    _ensure()
    with _engine().connect() as conn:
        return _row(conn.execute(
            select(_org_members).where(
                (_org_members.c.user_id == user_id) & (_org_members.c.status == "active")
            ).limit(1)
        ))


def add_org_member(org_id: str, user_id: str, role: str,
                    invited_by: str | None, joined_at: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(insert(_org_members).values(
            id=uuid.uuid4().hex[:12], org_id=org_id, user_id=user_id,
            role=role, invited_by=invited_by, status="active", joined_at=joined_at,
        ))


def list_org_members(org_id: str) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        rows = _rows(conn.execute(
            select(_org_members, _users.c.email)
            .join(_users, _users.c.id == _org_members.c.user_id)
            .where(_org_members.c.org_id == org_id)
            .where(_org_members.c.status == "active")
        ))
        return rows


def update_org_member_role(org_id: str, user_id: str, role: str) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(
            update(_org_members)
            .where((_org_members.c.org_id == org_id) & (_org_members.c.user_id == user_id))
            .values(role=role)
        )


def remove_org_member(org_id: str, user_id: str) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(
            update(_org_members)
            .where((_org_members.c.org_id == org_id) & (_org_members.c.user_id == user_id))
            .values(status="removed")
        )


def create_org_invite(invite_id: str, org_id: str, email: str, role: str,
                       token_hash: str, invited_by: str, expires_at: str) -> None:
    _ensure()
    from datetime import datetime, timezone
    with _engine().begin() as conn:
        conn.execute(insert(_org_invites).values(
            id=invite_id, org_id=org_id, email=email, role=role,
            token_hash=token_hash, invited_by=invited_by,
            expires_at=expires_at, accepted=0,
            created_at=datetime.now(timezone.utc).isoformat(),
        ))


def list_org_invites(org_id: str) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        return _rows(conn.execute(select(_org_invites).where(_org_invites.c.org_id == org_id)))


def get_org_invite_by_token(token_hash: str) -> dict | None:
    _ensure()
    with _engine().connect() as conn:
        return _row(conn.execute(select(_org_invites).where(_org_invites.c.token_hash == token_hash)))


def delete_org_invite(invite_id: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(delete(_org_invites).where(_org_invites.c.id == invite_id))


def mark_invite_accepted(invite_id: str) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(update(_org_invites).where(_org_invites.c.id == invite_id).values(accepted=1))


# Cashflow actuals
def save_cashflow_actual(id: str, user_id: str, week_start: str, category: str,
                          direction: str, amount: float, source: str, notes: str,
                          created_at: str, org_id: str | None = None) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(insert(_cashflow_actuals).values(
            id=id, user_id=user_id, org_id=org_id, week_start=week_start,
            category=category, direction=direction, amount=amount,
            source=source, notes=notes, created_at=created_at,
        ))


def list_cashflow_actuals(user_id: str) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        return _rows(conn.execute(
            select(_cashflow_actuals).where(_cashflow_actuals.c.user_id == user_id)
            .order_by(_cashflow_actuals.c.week_start)
        ))


def delete_cashflow_actual(entry_id: str, user_id: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(delete(_cashflow_actuals).where(
            (_cashflow_actuals.c.id == entry_id) & (_cashflow_actuals.c.user_id == user_id)
        ))


# Budgets
def save_budget(id: str, user_id: str, fiscal_year: int, category: str,
                 direction: str, weekly_amount: float, label: str,
                 created_at: str, org_id: str | None = None) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(insert(_budgets).values(
            id=id, user_id=user_id, org_id=org_id,
            fiscal_year=fiscal_year, category=category,
            direction=direction, weekly_amount=weekly_amount,
            label=label, created_at=created_at,
        ))


def list_budgets(user_id: str, fiscal_year: int | None = None) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        q = select(_budgets).where(_budgets.c.user_id == user_id)
        if fiscal_year:
            q = q.where(_budgets.c.fiscal_year == fiscal_year)
        return _rows(conn.execute(q.order_by(_budgets.c.category)))


def update_budget(budget_id: str, user_id: str, weekly_amount: float, label: str) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(
            update(_budgets).where(
                (_budgets.c.id == budget_id) & (_budgets.c.user_id == user_id)
            ).values(weekly_amount=weekly_amount, label=label)
        )


def delete_budget(budget_id: str, user_id: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(delete(_budgets).where(
            (_budgets.c.id == budget_id) & (_budgets.c.user_id == user_id)
        ))


# Customers MRR
def save_customer_mrr(id: str, user_id: str, name: str, arr: float,
                       contract_start: str | None, contract_end: str | None,
                       renewal_probability: float, status: str, billing_cycle: str,
                       created_at: str, org_id: str | None = None) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(insert(_customers_mrr).values(
            id=id, user_id=user_id, org_id=org_id, name=name, arr=arr,
            contract_start=contract_start, contract_end=contract_end,
            renewal_probability=renewal_probability, status=status,
            billing_cycle=billing_cycle, created_at=created_at,
        ))


def list_customers_mrr(user_id: str) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        return _rows(conn.execute(
            select(_customers_mrr).where(_customers_mrr.c.user_id == user_id)
            .order_by(_customers_mrr.c.created_at.desc())
        ))


def update_customer_mrr(customer_id: str, user_id: str, **fields) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(
            update(_customers_mrr).where(
                (_customers_mrr.c.id == customer_id) & (_customers_mrr.c.user_id == user_id)
            ).values(**fields)
        )


def delete_customer_mrr(customer_id: str, user_id: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(delete(_customers_mrr).where(
            (_customers_mrr.c.id == customer_id) & (_customers_mrr.c.user_id == user_id)
        ))


# Webhooks config
def save_webhook_cfg(id: str, user_id: str, url: str, events: str,
                      secret: str, created_at: str, org_id: str | None = None) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(insert(_webhooks_cfg).values(
            id=id, user_id=user_id, org_id=org_id, url=url,
            events=events, secret=secret, active=1, created_at=created_at,
        ))


def list_webhooks_cfg(user_id: str) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        return _rows(conn.execute(select(_webhooks_cfg).where(_webhooks_cfg.c.user_id == user_id)))


def get_webhook_cfg(hook_id: str, user_id: str) -> dict | None:
    _ensure()
    with _engine().connect() as conn:
        return _row(conn.execute(select(_webhooks_cfg).where(
            (_webhooks_cfg.c.id == hook_id) & (_webhooks_cfg.c.user_id == user_id)
        )))


def delete_webhook_cfg(hook_id: str, user_id: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(delete(_webhooks_cfg).where(
            (_webhooks_cfg.c.id == hook_id) & (_webhooks_cfg.c.user_id == user_id)
        ))


def update_webhook_active(hook_id: str, active: int) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(update(_webhooks_cfg).where(_webhooks_cfg.c.id == hook_id).values(active=active))


def list_webhooks_for_event(event: str, user_id: str | None) -> list[dict]:
    """Return all active webhooks that subscribe to `event` for this user."""
    _ensure()
    import json
    with _engine().connect() as conn:
        q = select(_webhooks_cfg).where(_webhooks_cfg.c.active == 1)
        if user_id:
            q = q.where(_webhooks_cfg.c.user_id == user_id)
        all_hooks = _rows(conn.execute(q))
    return [h for h in all_hooks if event in json.loads(h.get("events", "[]"))]


def save_webhook_delivery(delivery_id: str, webhook_id: str, event: str,
                           payload_preview: str | None, status_code: int | None,
                           error: str | None, next_retry_at: str | None,
                           attempt_count: int, success: bool) -> None:
    _ensure()
    from datetime import datetime, timezone
    with _engine().begin() as conn:
        conn.execute(insert(_webhook_deliveries).values(
            id=delivery_id, webhook_id=webhook_id, event=event,
            payload_preview=payload_preview, status_code=status_code,
            error=error, attempted_at=datetime.now(timezone.utc).isoformat(),
            next_retry_at=next_retry_at, attempt_count=attempt_count,
            success=int(success),
        ))


def list_webhook_deliveries(webhook_id: str, limit: int = 50) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        return _rows(conn.execute(
            select(_webhook_deliveries).where(_webhook_deliveries.c.webhook_id == webhook_id)
            .order_by(_webhook_deliveries.c.attempted_at.desc()).limit(limit)
        ))


# Cash accounts
def save_cash_account(id: str, user_id: str, name: str, account_type: str,
                       balance: float, credit_limit: float | None, currency: str,
                       as_of: str, created_at: str, org_id: str | None = None) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(insert(_cash_accounts).values(
            id=id, user_id=user_id, org_id=org_id, name=name,
            account_type=account_type, balance=balance, credit_limit=credit_limit,
            currency=currency, as_of=as_of, created_at=created_at,
        ))


def list_cash_accounts(user_id: str) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        return _rows(conn.execute(
            select(_cash_accounts).where(_cash_accounts.c.user_id == user_id)
            .order_by(_cash_accounts.c.created_at)
        ))


def update_cash_account(account_id: str, user_id: str, balance: float,
                         as_of: str, name: str, credit_limit: float | None) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(
            update(_cash_accounts).where(
                (_cash_accounts.c.id == account_id) & (_cash_accounts.c.user_id == user_id)
            ).values(balance=balance, as_of=as_of, name=name, credit_limit=credit_limit)
        )


def delete_cash_account(account_id: str, user_id: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(delete(_cash_accounts).where(
            (_cash_accounts.c.id == account_id) & (_cash_accounts.c.user_id == user_id)
        ))


# Scheduled forecasts
def save_scheduled_forecast(id: str, user_id: str, label: str, cadence: str,
                              day_of_week: int, config_json: str,
                              next_run_at: str, created_at: str,
                              org_id: str | None = None) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(insert(_scheduled_forecasts).values(
            id=id, user_id=user_id, org_id=org_id, label=label,
            cadence=cadence, day_of_week=day_of_week, config_json=config_json,
            active=1, last_run_at=None, next_run_at=next_run_at, created_at=created_at,
        ))


def list_scheduled_forecasts(user_id: str) -> list[dict]:
    _ensure()
    with _engine().connect() as conn:
        return _rows(conn.execute(
            select(_scheduled_forecasts).where(_scheduled_forecasts.c.user_id == user_id)
            .order_by(_scheduled_forecasts.c.created_at.desc())
        ))


def get_scheduled_forecast(sched_id: str, user_id: str) -> dict | None:
    _ensure()
    with _engine().connect() as conn:
        return _row(conn.execute(select(_scheduled_forecasts).where(
            (_scheduled_forecasts.c.id == sched_id) & (_scheduled_forecasts.c.user_id == user_id)
        )))


def update_scheduled_forecast_active(sched_id: str, active: int) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(update(_scheduled_forecasts).where(
            _scheduled_forecasts.c.id == sched_id
        ).values(active=active))


def delete_scheduled_forecast(sched_id: str, user_id: str) -> None:
    _ensure()
    with _engine().begin() as conn:
        conn.execute(delete(_scheduled_forecasts).where(
            (_scheduled_forecasts.c.id == sched_id) & (_scheduled_forecasts.c.user_id == user_id)
        ))


def update_scheduled_forecast_run(sched_id: str, last_run_at: str, next_run_at: str) -> None:
    _ensure()
    from sqlalchemy import update
    with _engine().begin() as conn:
        conn.execute(update(_scheduled_forecasts).where(
            _scheduled_forecasts.c.id == sched_id
        ).values(last_run_at=last_run_at, next_run_at=next_run_at))


# Notification preferences
def get_notification_prefs(user_id: str) -> dict | None:
    _ensure()
    with _engine().connect() as conn:
        return _row(conn.execute(select(_notification_prefs).where(
            _notification_prefs.c.user_id == user_id
        )))


def upsert_notification_prefs(user_id: str, email_digest_enabled: int,
                                digest_cadence: str, digest_day: int,
                                slack_enabled: int, webhook_enabled: int,
                                updated_at: str) -> None:
    _ensure()
    existing = get_notification_prefs(user_id)
    with _engine().begin() as conn:
        if existing:
            from sqlalchemy import update
            conn.execute(
                update(_notification_prefs).where(_notification_prefs.c.user_id == user_id)
                .values(
                    email_digest_enabled=email_digest_enabled,
                    digest_cadence=digest_cadence, digest_day=digest_day,
                    slack_enabled=slack_enabled, webhook_enabled=webhook_enabled,
                    updated_at=updated_at,
                )
            )
        else:
            conn.execute(insert(_notification_prefs).values(
                user_id=user_id, email_digest_enabled=email_digest_enabled,
                digest_cadence=digest_cadence, digest_day=digest_day,
                slack_enabled=slack_enabled, webhook_enabled=webhook_enabled,
                updated_at=updated_at,
            ))
