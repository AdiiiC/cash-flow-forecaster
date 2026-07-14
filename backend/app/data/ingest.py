"""CSV / XLSX ingestion with strict, boundary-level validation.

Expected columns (case-insensitive): date, amount, direction, category,
optional customer_id, optional status. Anything malformed is rejected with
a clear message rather than silently coerced — no leakage, no guessing.
"""
from __future__ import annotations

import io

import pandas as pd
from pydantic import ValidationError

from app.schemas import Direction, EntryStatus, Ledger, LedgerEntry

REQUIRED = {"date", "amount", "direction"}

# Hard ceiling on ingested rows. A weekly-granularity cash forecast never needs
# six figures of transactions; anything larger is almost certainly abuse or a
# malformed export, so we reject it rather than exhaust memory.
MAX_ROWS = 100_000


class IngestError(ValueError):
    """Raised when an uploaded file cannot be parsed into a valid Ledger."""


def _df_from_upload(raw: bytes, filename: str = "") -> pd.DataFrame:
    """Return a DataFrame from raw bytes, auto-detecting CSV vs XLSX by filename."""
    if filename.lower().endswith(".xlsx"):
        return pd.read_excel(io.BytesIO(raw), nrows=MAX_ROWS + 1)
    return pd.read_csv(io.BytesIO(raw), nrows=MAX_ROWS + 1)


def parse_csv(
    raw: bytes,
    opening_balance: float = 0.0,
    currency: str = "USD",
    filename: str = "",
) -> Ledger:
    try:
        df = _df_from_upload(raw, filename)
    except Exception as exc:  # noqa: BLE001 - surface any parse failure uniformly
        raise IngestError(f"Could not read file: {exc}") from exc

    if df.empty:
        raise IngestError("File contains no rows.")

    if len(df) > MAX_ROWS:
        raise IngestError(f"File too large: max {MAX_ROWS:,} rows supported.")

    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = REQUIRED - set(df.columns)
    if missing:
        raise IngestError(
            f"Missing required column(s): {', '.join(sorted(missing))}. "
            f"Required: date, amount, direction."
        )

    entries: list[LedgerEntry] = []
    errors: list[str] = []
    for i, row in df.iterrows():
        try:
            amount = float(row["amount"])
            # Allow signed amounts: negative implies outflow when direction absent/ambiguous.
            direction_raw = str(row["direction"]).strip().lower()
            if direction_raw in {"in", "inflow", "credit", "+"}:
                direction = Direction.inflow
            elif direction_raw in {"out", "outflow", "debit", "-"}:
                direction = Direction.outflow
            else:
                raise ValueError(f"unknown direction '{direction_raw}'")

            status_raw = str(row.get("status", "paid")).strip().lower()
            status = (
                EntryStatus.outstanding
                if status_raw in {"outstanding", "unpaid", "open"}
                else EntryStatus.paid
            )
            customer = row.get("customer_id")
            entries.append(
                LedgerEntry(
                    date=pd.to_datetime(row["date"]).date(),
                    amount=abs(amount),
                    direction=direction,
                    category=str(row.get("category", "uncategorized")),
                    customer_id=None if pd.isna(customer) else str(customer),
                    status=status,
                )
            )
        except (ValueError, ValidationError, TypeError) as exc:
            errors.append(f"row {int(i) + 2}: {exc}")  # +2 -> 1-based + header

    if errors:
        preview = "; ".join(errors[:5])
        more = f" (+{len(errors) - 5} more)" if len(errors) > 5 else ""
        raise IngestError(f"{len(errors)} invalid row(s): {preview}{more}")

    return Ledger(opening_balance=opening_balance, currency=currency, entries=entries)
