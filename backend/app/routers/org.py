"""Organisation (multi-tenancy) router.

Endpoints:
  POST   /api/org                       — create organisation (first admin)
  GET    /api/org                       — get current user's org
  GET    /api/org/members               — list members
  POST   /api/org/invite                — invite a new member by email
  DELETE /api/org/members/{user_id}     — remove a member (admin only)
  PATCH  /api/org/members/{user_id}/role — change role (admin only)
  GET    /api/org/invites               — list pending invites
  DELETE /api/org/invites/{invite_id}   — revoke invite
  POST   /api/org/accept-invite         — accept an emailed invite token
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app import store
from app.auth import create_access_token, get_current_user
from app.config import get_settings
from app.notifications.email import send_invite_email

router = APIRouter(prefix="/org", tags=["organisation"])


def _require_org_admin(user: dict) -> tuple[dict, dict]:
    """Return (user, membership) if user is an org admin; else 403."""
    mem = store.get_org_membership(user["id"])
    if not mem:
        raise HTTPException(403, "You are not part of an organisation.")
    if mem["role"] != "admin":
        raise HTTPException(403, "Only admins can perform this action.")
    return user, mem


# ── Create org ─────────────────────────────────────────────────────────────────
class OrgCreate(BaseModel):
    name: str
    fiscal_year_start_month: int = 1
    default_currency: str = "USD"


@router.post("", status_code=201)
def create_org(body: OrgCreate, user: dict = Depends(get_current_user)):
    if store.get_org_membership(user["id"]):
        raise HTTPException(400, "You are already a member of an organisation.")
    org_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    store.create_organisation(
        org_id=org_id,
        name=body.name.strip(),
        fiscal_year_start_month=body.fiscal_year_start_month,
        default_currency=body.default_currency.upper(),
        created_by=user["id"],
        created_at=now,
    )
    store.add_org_member(
        org_id=org_id, user_id=user["id"], role="admin",
        invited_by=None, joined_at=now,
    )
    store.record_audit("org.create", user_id=user["id"], entity=org_id)
    return store.get_organisation(org_id)


# ── Get current org ────────────────────────────────────────────────────────────
@router.get("")
def get_org(user: dict = Depends(get_current_user)):
    mem = store.get_org_membership(user["id"])
    if not mem:
        raise HTTPException(404, "You are not part of an organisation yet.")
    return store.get_organisation(mem["org_id"])


# ── Members ────────────────────────────────────────────────────────────────────
@router.get("/members")
def list_members(user: dict = Depends(get_current_user)):
    mem = store.get_org_membership(user["id"])
    if not mem:
        raise HTTPException(404, "Not in an organisation.")
    return store.list_org_members(mem["org_id"])


class RolePatch(BaseModel):
    role: str  # admin|member|viewer


@router.patch("/members/{target_user_id}/role")
def change_role(target_user_id: str, body: RolePatch,
                user: dict = Depends(get_current_user)):
    user, mem = _require_org_admin(user)
    if target_user_id == user["id"]:
        raise HTTPException(400, "Cannot change your own role.")
    if body.role not in ("admin", "member", "viewer"):
        raise HTTPException(400, "Role must be admin, member, or viewer.")
    store.update_org_member_role(mem["org_id"], target_user_id, body.role)
    store.record_audit("org.member.role_changed", user_id=user["id"], entity=target_user_id)
    return {"ok": True}


@router.delete("/members/{target_user_id}", status_code=204)
def remove_member(target_user_id: str, user: dict = Depends(get_current_user)):
    user, mem = _require_org_admin(user)
    if target_user_id == user["id"]:
        raise HTTPException(400, "Cannot remove yourself.")
    store.remove_org_member(mem["org_id"], target_user_id)
    store.record_audit("org.member.removed", user_id=user["id"], entity=target_user_id)


# ── Invite ─────────────────────────────────────────────────────────────────────
class InviteBody(BaseModel):
    email: EmailStr
    role: str = "member"


@router.post("/invite", status_code=201)
def invite_member(body: InviteBody, bg: BackgroundTasks,
                  user: dict = Depends(get_current_user)):
    user, mem = _require_org_admin(user)
    org = store.get_organisation(mem["org_id"])
    if not org:
        raise HTTPException(404, "Organisation not found.")

    token = secrets.token_urlsafe(32)
    invite_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(hours=48)).isoformat()

    import hashlib
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    store.create_org_invite(
        invite_id=invite_id,
        org_id=mem["org_id"],
        email=body.email,
        role=body.role,
        token_hash=token_hash,
        invited_by=user["id"],
        expires_at=expires,
    )
    store.record_audit("org.invite.sent", user_id=user["id"], entity=body.email)

    settings = get_settings()
    invite_url = f"{settings.frontend_origin}/accept-invite?token={token}"
    bg.add_task(send_invite_email, body.email, org["name"], user["email"], invite_url)
    return {"invite_id": invite_id, "email": body.email, "expires_at": expires}


@router.get("/invites")
def list_invites(user: dict = Depends(get_current_user)):
    user, mem = _require_org_admin(user)
    return store.list_org_invites(mem["org_id"])


@router.delete("/invites/{invite_id}", status_code=204)
def revoke_invite(invite_id: str, user: dict = Depends(get_current_user)):
    _require_org_admin(user)
    store.delete_org_invite(invite_id)


# ── Accept invite ──────────────────────────────────────────────────────────────
class AcceptInviteBody(BaseModel):
    token: str


@router.post("/accept-invite")
def accept_invite(body: AcceptInviteBody, user: dict = Depends(get_current_user)):
    import hashlib
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    invite = store.get_org_invite_by_token(token_hash)
    if not invite:
        raise HTTPException(404, "Invite not found or already used.")
    expires = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(410, "Invite link has expired.")
    if invite["accepted"]:
        raise HTTPException(409, "Invite already accepted.")
    if invite["email"].lower() != user["email"].lower():
        raise HTTPException(403, "This invite was sent to a different email address.")

    now = datetime.now(timezone.utc).isoformat()
    store.add_org_member(
        org_id=invite["org_id"], user_id=user["id"],
        role=invite["role"], invited_by=invite["invited_by"],
        joined_at=now,
    )
    store.mark_invite_accepted(invite["id"])
    store.record_audit("org.invite.accepted", user_id=user["id"], entity=invite["org_id"])
    return store.get_organisation(invite["org_id"])
