"""Public contact / demo-request endpoint + admin submissions view."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from app import store
from app.auth import get_current_user
from app.config import get_settings

router = APIRouter(tags=["contact"])


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    company: str
    team_size: str
    message: str
    turnstile_token: str | None = None
    # Optional ROI calculator context surfaced to sales
    context: str | None = None


async def _verify_turnstile(token: str, ip: str) -> bool:
    secret = get_settings().turnstile_secret
    if not secret:
        return True  # not configured — skip
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": secret, "response": token, "remoteip": ip},
        )
    return bool(resp.json().get("success"))


async def _post_to_slack(body: ContactRequest) -> None:
    url = get_settings().slack_webhook_url
    if not url:
        return
    lines = [
        ":envelope: *New demo request via ClearCash*",
        f"*Name:* {body.name}",
        f"*Email:* {body.email}",
        f"*Company:* {body.company}  ({body.team_size})",
        f"*Message:* {body.message[:400]}",
    ]
    if body.context:
        lines.append(f"*ROI context:* {body.context}")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            await client.post(url, json={"text": "\n".join(lines)})
    except Exception:
        pass  # non-blocking; never fail the request over Slack


@router.post("/contact", status_code=201)
async def submit_contact(body: ContactRequest, request: Request):
    ip = request.client.host if request.client else "unknown"

    if body.turnstile_token:
        if not await _verify_turnstile(body.turnstile_token, ip):
            raise HTTPException(400, "Captcha verification failed. Please try again.")

    now = datetime.now(timezone.utc).isoformat()
    sub_id = uuid.uuid4().hex[:16]

    store.save_contact_submission(
        id=sub_id,
        name=body.name,
        email=body.email,
        company=body.company,
        team_size=body.team_size,
        message=body.message,
        context=body.context or "",
        ip=ip,
        created_at=now,
    )

    await _post_to_slack(body)

    return {"ok": True, "id": sub_id}


# ── Admin: view submissions ───────────────────────────────────────────────────

def _require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin access required.")
    return user


@router.get("/admin/contact-submissions")
def list_submissions(_: dict = Depends(_require_admin)):
    return store.list_contact_submissions()
