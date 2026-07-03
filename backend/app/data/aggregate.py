"""Aggregate a point-in-time ledger into weekly series for forecasting.

Weeks end on Sunday. We build four series:
- inflow: all cash coming in
- outflow: all cash going out
- net_cash_flow: inflow - outflow
- mrr: recurring subscription inflows, annualized to a monthly run-rate
"""
from __future__ import annotations

import pandas as pd

from app.schemas import Direction, Ledger

RECURRING_CATEGORIES = {"subscription", "recurring", "mrr"}


def ledger_to_frame(ledger: Ledger) -> pd.DataFrame:
    rows = [
        {
            "date": e.date,
            "amount": e.amount,
            "direction": e.direction.value,
            "category": e.category,
        }
        for e in ledger.entries
    ]
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    return df


def weekly_series(ledger: Ledger) -> dict[str, pd.Series]:
    df = ledger_to_frame(ledger)
    # Resample to week-ending Sunday ("W" defaults to Sunday-anchored weeks).
    df = df.set_index("date").sort_index()

    signed = df["amount"] * df["direction"].map({"inflow": 1.0, "outflow": -1.0})
    net = signed.resample("W").sum()

    inflow = df.loc[df["direction"] == Direction.inflow.value, "amount"].resample("W").sum()
    outflow = df.loc[df["direction"] == Direction.outflow.value, "amount"].resample("W").sum()

    recurring_mask = (df["direction"] == Direction.inflow.value) & (
        df["category"].isin(RECURRING_CATEGORIES)
    )
    weekly_recurring = df.loc[recurring_mask, "amount"].resample("W").sum()
    # Convert weekly recurring recognition into an MRR run-rate (~4.33 weeks/month).
    mrr = weekly_recurring * 4.33

    # Align all series onto the union of weeks, filling gaps with 0 (no activity).
    full_index = net.index
    out = {
        "net_cash_flow": net.reindex(full_index).fillna(0.0),
        "inflow": inflow.reindex(full_index).fillna(0.0),
        "outflow": outflow.reindex(full_index).fillna(0.0),
        "mrr": mrr.reindex(full_index).ffill().fillna(0.0),
    }
    for name, s in out.items():
        s.name = name
    return out
