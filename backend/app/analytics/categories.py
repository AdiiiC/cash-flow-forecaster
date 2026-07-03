"""Exact category-level decomposition of cash flow.

Unlike a fitted "feature importance", every number here is a direct arithmetic
fact about the ledger: net cash flow *is* the sum of signed category flows, so
each category's contribution and volatility are computed, not estimated. This
powers the waterfall chart (categories) and the driver bars (drivers).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.data.aggregate import ledger_to_frame
from app.schemas import CategoryFlow, Direction, Driver, Ledger


def _weekly_by_category(ledger: Ledger) -> pd.DataFrame:
    """Weekly total magnitude per (category, direction). Index = week-ending."""
    df = ledger_to_frame(ledger)
    df = df.set_index("date").sort_index()
    grouped = (
        df.groupby([pd.Grouper(freq="W"), "category", "direction"])["amount"].sum().reset_index()
    )
    return grouped


def analyze_categories(
    ledger: Ledger,
    inflow_p50_total: float,
    outflow_p50_total: float,
) -> tuple[list[CategoryFlow], list[Driver]]:
    """Return (category breakdown, ranked drivers).

    Projected category totals distribute the forecast horizon inflow / outflow
    (p50) across categories by each category's historical share of its
    direction — a transparent, sums-to-total allocation.
    """
    grouped = _weekly_by_category(ledger)
    if grouped.empty:
        return [], []

    n_weeks = max(grouped["date"].nunique(), 1)

    inflow_gross = grouped.loc[grouped["direction"] == "inflow", "amount"].sum() or 1.0
    outflow_gross = grouped.loc[grouped["direction"] == "outflow", "amount"].sum() or 1.0
    net_abs_gross = inflow_gross + outflow_gross

    categories: list[CategoryFlow] = []
    drivers: list[Driver] = []

    for (category, direction), rows in grouped.groupby(["category", "direction"]):
        weekly = rows.set_index("date")["amount"].reindex(
            pd.date_range(grouped["date"].min(), grouped["date"].max(), freq="W")
        ).fillna(0.0)
        total = float(weekly.sum())
        weekly_mean = float(weekly.mean())
        volatility = float(weekly.std(ddof=0))
        direction_gross = inflow_gross if direction == "inflow" else outflow_gross
        share = float(total / direction_gross) if direction_gross else 0.0
        horizon_total = inflow_p50_total if direction == "inflow" else outflow_p50_total
        projected_total = float(share * horizon_total)

        sign = 1.0 if direction == "inflow" else -1.0
        categories.append(
            CategoryFlow(
                category=category,
                direction=Direction(direction),
                hist_weekly_mean=round(sign * weekly_mean, 2),
                hist_total=round(sign * total, 2),
                share=round(share, 4),
                projected_total=round(sign * projected_total, 2),
                volatility=round(volatility, 2),
            )
        )
        drivers.append(
            Driver(
                category=category,
                direction=Direction(direction),
                impact=round(sign * weekly_mean, 2),
                share_of_net_abs=round(float(total / net_abs_gross), 4),
                volatility=round(volatility, 2),
            )
        )

    # Waterfall reads best with inflows first (desc), then outflows (desc magnitude).
    categories.sort(key=lambda c: (c.direction != Direction.inflow, -abs(c.hist_total)))
    drivers.sort(key=lambda d: -abs(d.impact))
    return categories, drivers
