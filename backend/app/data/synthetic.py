"""Deterministic synthetic SaaS ledger generator.

Produces a realistic-but-fake weekly transaction stream: recurring
subscription revenue (MRR) with growth + churn, one-off expansion deals,
and lumpy operating costs (payroll, infra, marketing, rent). Deterministic
given a seed so demos and tests are reproducible.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np

from app.schemas import Direction, EntryStatus, Ledger, LedgerEntry


def _week_ending(anchor: date, week_index: int) -> date:
    return anchor + timedelta(weeks=week_index)


def generate_ledger(
    weeks: int = 104,
    seed: int = 42,
    starting_mrr: float = 80_000.0,
    opening_balance: float = 250_000.0,
    currency: str = "USD",
) -> Ledger:
    rng = np.random.default_rng(seed)
    # Anchor to a Sunday so periods align to week-ending Sundays.
    today = date(2026, 6, 28)  # a Sunday
    start = today - timedelta(weeks=weeks - 1)

    entries: list[LedgerEntry] = []

    # MRR evolves with modest growth and stochastic churn.
    mrr = starting_mrr
    growth_rate = 0.012  # ~1.2% weekly gross new
    churn_rate = 0.006

    for w in range(weeks):
        wk = _week_ending(start, w)

        # --- Recurring subscription revenue (weekly recognition of MRR/4.33) ---
        seasonal = 1.0 + 0.06 * np.sin(2 * np.pi * (w % 52) / 52.0)
        noise = rng.normal(1.0, 0.03)
        weekly_recurring = (mrr / 4.33) * seasonal * max(noise, 0.5)
        entries.append(
            LedgerEntry(
                date=wk,
                amount=round(float(weekly_recurring), 2),
                direction=Direction.inflow,
                category="subscription",
                status=EntryStatus.paid,
            )
        )

        # Occasional expansion / annual prepay (lumpy, positive skew).
        if rng.random() < 0.18:
            deal = rng.gamma(shape=2.0, scale=9_000.0)
            entries.append(
                LedgerEntry(
                    date=wk,
                    amount=round(float(deal), 2),
                    direction=Direction.inflow,
                    category="expansion",
                    status=EntryStatus.paid if rng.random() > 0.3 else EntryStatus.outstanding,
                )
            )

        # --- Operating expenses ---
        # Payroll every 2 weeks (bi-weekly), the dominant outflow.
        if w % 2 == 0:
            payroll = 62_000.0 * rng.normal(1.0, 0.02)
            entries.append(
                LedgerEntry(
                    date=wk,
                    amount=round(float(payroll), 2),
                    direction=Direction.outflow,
                    category="payroll",
                    status=EntryStatus.paid,
                )
            )

        # Infra scales gently with MRR.
        infra = (mrr * 0.05) * rng.normal(1.0, 0.05)
        entries.append(
            LedgerEntry(
                date=wk,
                amount=round(float(infra), 2),
                direction=Direction.outflow,
                category="infra",
                status=EntryStatus.paid,
            )
        )

        # Marketing spend, bursty around quarter starts.
        quarter_push = 1.8 if (w % 13) in (0, 1) else 1.0
        marketing = 11_000.0 * quarter_push * rng.normal(1.0, 0.1)
        entries.append(
            LedgerEntry(
                date=wk,
                amount=round(float(marketing), 2),
                direction=Direction.outflow,
                category="marketing",
                status=EntryStatus.paid,
            )
        )

        # Monthly rent (every ~4.33 weeks -> approximate every 4 weeks).
        if w % 4 == 0:
            entries.append(
                LedgerEntry(
                    date=wk,
                    amount=18_500.0,
                    direction=Direction.outflow,
                    category="rent",
                    status=EntryStatus.paid,
                )
            )

        # Evolve MRR.
        gross_new = mrr * growth_rate * rng.normal(1.0, 0.25)
        churned = mrr * churn_rate * rng.normal(1.0, 0.25)
        mrr = max(mrr + gross_new - churned, starting_mrr * 0.5)

    return Ledger(opening_balance=opening_balance, currency=currency, entries=entries)
