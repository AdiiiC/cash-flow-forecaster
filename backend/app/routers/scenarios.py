"""Saved scenario endpoints: personal named what-if presets (auth required)."""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app import store
from app.auth import get_current_user
from app.schemas import SavedScenario, ScenarioCreate, ScenarioInput

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


def _to_public(row: dict) -> SavedScenario:
    created = row["created_at"]
    return SavedScenario(
        id=row["id"],
        name=row["name"],
        scenario=ScenarioInput.model_validate(json.loads(row["payload"])),
        created_at=created if isinstance(created, datetime) else datetime.fromisoformat(created),
    )


@router.get("", response_model=list[SavedScenario])
def list_scenarios(user: dict = Depends(get_current_user)) -> list[SavedScenario]:
    return [_to_public(r) for r in store.list_scenarios(user["id"])]


@router.post("", response_model=SavedScenario, status_code=status.HTTP_201_CREATED)
def create_scenario(
    body: ScenarioCreate, user: dict = Depends(get_current_user)
) -> SavedScenario:
    row = store.save_scenario(user["id"], body.name, body.scenario.model_dump_json())
    store.record_audit("scenario.create", user_id=user["id"], entity=row["id"])
    return _to_public(row)


@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: str, user: dict = Depends(get_current_user)) -> dict:
    if not store.delete_scenario(scenario_id, user["id"]):
        raise HTTPException(status_code=404, detail="Scenario not found.")
    store.record_audit("scenario.delete", user_id=user["id"], entity=scenario_id)
    return {"deleted": scenario_id}
