"""Auth endpoint + run-scoping tests (SQLite via conftest)."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import store
from app.main import app

client = TestClient(app)


def _email() -> str:
    return f"user_{uuid.uuid4().hex[:8]}@example.com"


def test_register_login_me_flow():
    email = _email()
    # register
    r = client.post("/api/auth/register", json={"email": email, "password": "secret12345"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == email
    token = body["access_token"]

    # duplicate registration is rejected
    r2 = client.post("/api/auth/register", json={"email": email, "password": "secret12345"})
    assert r2.status_code == 409

    # login with correct + wrong password
    ok = client.post("/api/auth/login", json={"email": email, "password": "secret12345"})
    assert ok.status_code == 200
    bad = client.post("/api/auth/login", json={"email": email, "password": "nope"})
    assert bad.status_code == 401

    # /me requires a valid token
    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_short_password_rejected():
    r = client.post("/api/auth/register", json={"email": _email(), "password": "short"})
    assert r.status_code == 422


def test_saved_scenarios_flow():
    # Register two users; saved scenarios are private per user.
    t1 = client.post(
        "/api/auth/register", json={"email": _email(), "password": "secret12345"}
    ).json()["access_token"]
    t2 = client.post(
        "/api/auth/register", json={"email": _email(), "password": "secret12345"}
    ).json()["access_token"]
    h1 = {"Authorization": f"Bearer {t1}"}
    h2 = {"Authorization": f"Bearer {t2}"}

    # Auth is required.
    assert client.get("/api/scenarios").status_code == 401

    payload = {
        "name": "Aggressive growth",
        "scenario": {"label": "Aggressive", "revenue_growth_pct": 5.0, "cost_multiplier": 1.1},
    }
    created = client.post("/api/scenarios", json=payload, headers=h1)
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    assert created.json()["scenario"]["revenue_growth_pct"] == 5.0

    # Owner sees it; the other user does not.
    assert [s["id"] for s in client.get("/api/scenarios", headers=h1).json()] == [sid]
    assert client.get("/api/scenarios", headers=h2).json() == []

    # A blank name is rejected.
    assert (
        client.post(
            "/api/scenarios",
            json={"name": "  ", "scenario": payload["scenario"]},
            headers=h1,
        ).status_code
        == 422
    )

    # Another user cannot delete it; the owner can.
    assert client.delete(f"/api/scenarios/{sid}", headers=h2).status_code == 404
    assert client.delete(f"/api/scenarios/{sid}", headers=h1).status_code == 200
    assert client.get("/api/scenarios", headers=h1).json() == []


def test_runs_are_scoped_per_user():
    # Two users each own a saved run; neither sees the other's.
    from app.schemas import ForecastResponse

    payload = ForecastResponse.model_validate(
        {
            "generated_at": "2024-01-01T00:00:00",
            "as_of": "2024-01-01",
            "horizon_weeks": 13,
            "currency": "USD",
            "opening_balance": 1000.0,
            "runway_weeks": None,
            "projected_balance_p50": 1200.0,
            "series": [],
            "narrative": {"text": "x", "source": "template", "grounded": True, "used_values": {}},
        }
    )
    u1 = store.create_user(_email(), "h")["id"]
    u2 = store.create_user(_email(), "h")["id"]
    r1 = store.save_run(payload, source="demo", label="u1 run", user_id=u1)
    store.save_run(payload, source="demo", label="u2 run", user_id=u2)

    ids_u1 = {r.id for r in store.list_runs(user_id=u1)}
    ids_u2 = {r.id for r in store.list_runs(user_id=u2)}
    assert r1 in ids_u1
    assert r1 not in ids_u2
    # u2 cannot fetch u1's run by id
    assert store.get_run(r1, user_id=u2) is None
    assert store.get_run(r1, user_id=u1) is not None
