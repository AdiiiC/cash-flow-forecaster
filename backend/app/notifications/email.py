"""Email notifications via Resend (https://resend.com).

Set RESEND_API_KEY in environment. Falls back to a no-op log when key absent.
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

log = logging.getLogger(__name__)


def _client():
    import resend
    resend.api_key = get_settings().resend_api_key
    return resend


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email; returns True on success, False on any failure."""
    settings = get_settings()
    if not settings.resend_api_key.strip():
        log.info("RESEND_API_KEY not set — email suppressed: %s → %s", to, subject)
        return False
    try:
        r = _client()
        r.Emails.send({
            "from":    settings.email_from,
            "to":      [to],
            "subject": subject,
            "html":    html,
        })
        return True
    except Exception as exc:
        log.warning("Email send failed (%s → %s): %s", to, subject, exc)
        return False


def send_otp_email(to: str, code: str) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:40px auto">
      <h2 style="color:#1a1a1a">Your ClearCash verification code</h2>
      <p>Enter this code to complete your sign-in. It expires in 10 minutes.</p>
      <div style="font-size:2.4rem;font-weight:700;letter-spacing:0.2em;
                  background:#f5f5f5;padding:20px 28px;border-radius:8px;
                  text-align:center;color:#0f172a">{code}</div>
      <p style="color:#666;font-size:0.9rem;margin-top:24px">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>"""
    return send_email(to, "Your ClearCash login code", html)


def send_invite_email(to: str, org_name: str, invited_by: str, invite_url: str) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:40px auto">
      <h2 style="color:#1a1a1a">You've been invited to {org_name}</h2>
      <p><strong>{invited_by}</strong> has invited you to join their organisation
         on ClearCash, the cash-flow forecasting platform.</p>
      <a href="{invite_url}"
         style="display:inline-block;background:#f59e0b;color:#fff;
                padding:12px 24px;border-radius:6px;text-decoration:none;
                font-weight:600;margin-top:16px">Accept invitation</a>
      <p style="color:#666;font-size:0.9rem;margin-top:24px">
        This link expires in 48 hours.
      </p>
    </div>"""
    return send_email(to, f"You're invited to {org_name} on ClearCash", html)


def send_weekly_digest(
    to: str,
    runway_weeks: float | None,
    projected_balance: float,
    currency: str,
    alerts: list[dict[str, Any]],
    org_name: str = "Your company",
) -> bool:
    runway_txt = (
        f"{runway_weeks:.0f} weeks" if runway_weeks else "<strong>Solvent through horizon</strong>"
    )
    alert_rows = "".join(
        f"<li style='color:{'#dc2626' if a.get('level')=='critical' else '#d97706'}'>"
        f"{a.get('message','')}</li>"
        for a in alerts[:5]
    ) or "<li style='color:#16a34a'>No active alerts</li>"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:40px auto">
      <h2 style="color:#1a1a1a">Weekly Cash-Flow Digest — {org_name}</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:12px 16px;background:#f9fafb;border-radius:8px">
            <div style="font-size:0.8rem;color:#666">Projected Balance</div>
            <div style="font-size:1.6rem;font-weight:700">{currency} {projected_balance:,.0f}</div>
          </td>
          <td style="padding:12px 16px;background:#f9fafb;border-radius:8px;margin-left:12px">
            <div style="font-size:0.8rem;color:#666">Cash Runway</div>
            <div style="font-size:1.4rem;font-weight:700">{runway_txt}</div>
          </td>
        </tr>
      </table>
      <h3 style="margin-top:28px">Active Alerts</h3>
      <ul>{alert_rows}</ul>
      <p style="color:#888;font-size:0.8rem">
        Manage notification preferences in your ClearCash account settings.
      </p>
    </div>"""
    return send_email(to, f"Weekly Cash Digest — {org_name}", html)
