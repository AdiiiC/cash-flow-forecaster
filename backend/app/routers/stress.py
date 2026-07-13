"""Parallel stress-test / multi-scenario comparison.

POST /api/stress-test
Body: { scenarios: [{label, ...ScenarioInput}], weights: [0.3, 0.5, 0.2] }

Runs up to 5 scenarios in parallel (reusing the existing ThreadPoolExecutor
pattern from service.py) and returns comparison results plus a
probability-weighted blended expectation.
"""
from __future__ import annotations

import concurrent.futures
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, validator

from app.auth import get_current_user_optional
from app.schemas import ScenarioInput
from app.service import build_forecast

router = APIRouter(prefix="/stress-test", tags=["stress-test"])


class StressScenario(ScenarioInput):
    label: str = "Scenario"


class StressTestRequest(BaseModel):
    # Demo parameters (same as SyntheticRequest)
    weeks: int = 104
    seed: int = 42
    starting_mrr: float = 80_000
    opening_balance: float = 250_000
    currency: str = "USD"

    scenarios: list[StressScenario]
    weights: Optional[list[float]] = None   # must sum to ≤1; defaults to equal

    @validator("scenarios")
    def _max_5(cls, v):
        if len(v) > 5:
            raise ValueError("Maximum 5 scenarios per stress-test run.")
        if not v:
            raise ValueError("At least one scenario required.")
        return v

    @validator("weights", always=True)
    def _weights(cls, v, values):
        scenarios = values.get("scenarios", [])
        if v is None:
            n = len(scenarios)
            return [round(1 / n, 4)] * n if n else []
        if len(v) != len(scenarios):
            raise ValueError("len(weights) must equal len(scenarios).")
        if any(w < 0 for w in v):
            raise ValueError("All weights must be non-negative.")
        return v


class ScenarioResult(BaseModel):
    label: str
    projected_balance_p50: float
    runway_weeks: Optional[float]
    net_total: Optional[float]
    weight: float


class StressTestResponse(BaseModel):
    scenarios: list[ScenarioResult]
    weighted_projected_balance: float
    weighted_runway_weeks: Optional[float]
    breakeven_revenue_growth_pct: Optional[float]


@router.post("", response_model=StressTestResponse)
def stress_test(body: StressTestRequest,
                user: dict | None = Depends(get_current_user_optional)):
    from app.schemas import SyntheticRequest
    from app.data.synthetic import generate_ledger

    user_id = user["id"] if user else None

    def _run_one(scenario: StressScenario):
        req = SyntheticRequest(
            weeks=body.weeks,
            seed=body.seed,
            starting_mrr=body.starting_mrr,
            opening_balance=body.opening_balance,
            currency=body.currency,
            scenario=scenario,
        )
        ledger = generate_ledger(req)
        return build_forecast(ledger, source="stress_test", user_id=user_id,
                               persist=False, use_cache=False)

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(5, len(body.scenarios))) as ex:
        futures = {ex.submit(_run_one, sc): (sc, w)
                   for sc, w in zip(body.scenarios, body.weights)}
        for fut, (sc, w) in futures.items():
            try:
                r = fut.result(timeout=120)
                results.append(ScenarioResult(
                    label=sc.label,
                    projected_balance_p50=r.projected_balance_p50,
                    runway_weeks=r.runway_weeks,
                    net_total=sum(
                        p.p50 for s in r.series if s.name == "net_cash_flow"
                        for p in s.forecast
                    ) if r.series else None,
                    weight=w,
                ))
            except Exception:
                results.append(ScenarioResult(
                    label=sc.label,
                    projected_balance_p50=0,
                    runway_weeks=None,
                    net_total=None,
                    weight=w,
                ))

    # Weighted expected balance
    total_w = sum(body.weights)
    weighted_bal = sum(r.projected_balance_p50 * r.weight for r in results) / (total_w or 1)
    runways = [r.runway_weeks for r in results if r.runway_weeks is not None]
    weighted_runway = (
        sum(r.runway_weeks * r.weight for r in results if r.runway_weeks)
        / (sum(r.weight for r in results if r.runway_weeks) or 1)
        if runways else None
    )

    # Simple breakeven: find lowest revenue_growth_pct among scenarios where runway≥horizon
    breakeven = None
    for sc, r in zip(body.scenarios, results):
        if r.runway_weeks is None:  # solvent through horizon
            breakeven = min(breakeven, sc.revenue_growth_pct) if breakeven is not None else sc.revenue_growth_pct

    return StressTestResponse(
        scenarios=results,
        weighted_projected_balance=round(weighted_bal, 2),
        weighted_runway_weeks=round(weighted_runway, 1) if weighted_runway else None,
        breakeven_revenue_growth_pct=breakeven,
    )
