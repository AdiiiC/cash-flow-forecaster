"""Tests for field encryption and the audit log."""
from __future__ import annotations

import importlib
import uuid

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app import store
from app.main import app

client = TestClient(app)


def _fresh_crypto(monkeypatch, key: str):
    """Reload the crypto module with a given DATA_ENCRYPTION_KEY."""
    import app.config as config

    monkeypatch.setenv("DATA_ENCRYPTION_KEY", key)
    config.get_settings.cache_clear()
    import app.security.crypto as crypto

    importlib.reload(crypto)
    return crypto


def test_encrypt_roundtrip_with_key(monkeypatch):
    crypto = _fresh_crypto(monkeypatch, Fernet.generate_key().decode())
    assert crypto.is_enabled() is True
    token = crypto.encrypt("Acme Corp")
    assert token is not None
    assert token.startswith("enc:v1:")
    assert "Acme Corp" not in token
    assert crypto.decrypt(token) == "Acme Corp"


def test_encrypt_passthrough_without_key(monkeypatch):
    crypto = _fresh_crypto(monkeypatch, "")
    assert crypto.is_enabled() is False
    assert crypto.encrypt("plain") == "plain"
    assert crypto.decrypt("plain") == "plain"


def test_encrypt_handles_none(monkeypatch):
    crypto = _fresh_crypto(monkeypatch, Fernet.generate_key().decode())
    assert crypto.encrypt(None) is None
    assert crypto.decrypt(None) is None


def test_decrypt_tolerates_legacy_plaintext(monkeypatch):
    # Value written before a key existed has no prefix and is returned as-is.
    crypto = _fresh_crypto(monkeypatch, Fernet.generate_key().decode())
    assert crypto.decrypt("legacy plaintext") == "legacy plaintext"


def test_audit_records_on_register_and_login():
    email = f"audit-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 201
    token = r.json()["access_token"]

    r = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    assert r.status_code == 200

    r = client.get("/api/auth/me/audit", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    actions = {e["action"] for e in r.json()}
    assert "auth.register" in actions
    assert "auth.login" in actions


def test_audit_is_scoped_per_user():
    a = client.post(
        "/api/auth/register",
        json={"email": f"audit-a-{uuid.uuid4().hex[:8]}@example.com", "password": "password123"},
    ).json()["access_token"]
    b = client.post(
        "/api/auth/register",
        json={"email": f"audit-b-{uuid.uuid4().hex[:8]}@example.com", "password": "password123"},
    ).json()["access_token"]

    # Create a scenario as A so there's an audited action tied to A only.
    payload = {
        "name": "My plan",
        "scenario": {"label": "base", "revenue_growth_pct": 0, "cost_multiplier": 1.0},
    }
    client.post("/api/scenarios", json=payload, headers={"Authorization": f"Bearer {a}"})

    b_entries = client.get(
        "/api/auth/me/audit", headers={"Authorization": f"Bearer {b}"}
    ).json()
    assert all(e["action"] != "scenario.create" for e in b_entries)


def test_record_audit_never_raises():
    # Bad meta or backend hiccups must not propagate.
    store.record_audit("test.action", user_id="nobody", meta={"ok": True})
