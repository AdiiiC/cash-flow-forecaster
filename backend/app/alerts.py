"""Threshold evaluation -> user-facing alerts.

Pure functions over an already-computed forecast. No side effects, so alerts
can be recomputed instantly when the user changes a threshold.
"""
from __future__ import annotations

from app.schemas import Alert, ForecastResponse, Thresholds


def evaluate(response: ForecastResponse, thresholds: Thresholds | None) -> list[Alert]:
    alerts: list[Alert] = []

    # Structural alert: runway ends inside the horizon regardless of thresholds.
    if response.runway_weeks is not None:
        alerts.append(
            Alert(
                level="critical",
                code="runway",
                message=(
                    f"Projected cash turns negative in ~{response.runway_weeks:.0f} weeks "
                    f"(within the {response.horizon_weeks}-week horizon)."
                ),
                value=response.runway_weeks,
            )
        )

    if thresholds is None:
        return alerts

    if thresholds.min_balance is not None:
        proj = response.projected_balance_p50
        if proj < thresholds.min_balance:
            alerts.append(
                Alert(
                    level="warning",
                    code="balance_floor",
                    message=(
                        f"Projected balance {proj:,.0f} falls below your floor of "
                        f"{thresholds.min_balance:,.0f}."
                    ),
                    value=proj,
                    threshold=thresholds.min_balance,
                )
            )

    if thresholds.min_runway_weeks is not None and response.runway_weeks is not None:
        if response.runway_weeks < thresholds.min_runway_weeks:
            alerts.append(
                Alert(
                    level="critical",
                    code="runway_floor",
                    message=(
                        f"Runway of {response.runway_weeks:.0f}w is shorter than your minimum "
                        f"of {thresholds.min_runway_weeks:.0f}w."
                    ),
                    value=response.runway_weeks,
                    threshold=thresholds.min_runway_weeks,
                )
            )

    if not alerts:
        alerts.append(
            Alert(
                level="info",
                code="ok",
                message="No thresholds breached. Cash trajectory is within configured limits.",
            )
        )
    return alerts
