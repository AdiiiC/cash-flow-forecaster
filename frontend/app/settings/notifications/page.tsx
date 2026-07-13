"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "";
const authH = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

export default function NotificationsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({
    email_digest_enabled: true, digest_cadence: "weekly", digest_day: 1,
    slack_enabled: true, webhook_enabled: true,
  });
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [wUrl, setWUrl] = useState("");
  const [wEvents, setWEvents] = useState<string[]>(["alert.critical"]);
  const [info, setInfo] = useState("");
  const [mfaStatus, setMfaStatus] = useState({ totp_enabled: false, email_otp_enabled: false });
  const [showTotpSetup, setShowTotpSetup] = useState(false);

  const ALL_EVENTS = [
    "forecast.completed","alert.critical","alert.warning",
    "invoice.overdue","runway.critical","actuals.variance_exceeded","budget.breach",
  ];

  useEffect(() => {
    const t = localStorage.getItem("cff.token");
    setToken(t); if (t) loadAll(t);
  }, []);

  async function loadAll(t: string) {
    const [pRes, wRes, mRes] = await Promise.all([
      fetch(`${API}/api/notification-prefs`, { headers: authH(t) }),
      fetch(`${API}/api/webhooks-config`,    { headers: authH(t) }),
      fetch(`${API}/api/auth/mfa/status`,    { headers: authH(t) }),
    ]);
    if (pRes.ok) setPrefs(await pRes.json());
    if (wRes.ok) setWebhooks(await wRes.json());
    if (mRes.ok) setMfaStatus(await mRes.json());
  }

  async function savePrefs() {
    if (!token) return;
    const res = await fetch(`${API}/api/notification-prefs`, {
      method: "PUT", headers: authH(token), body: JSON.stringify(prefs),
    });
    if (res.ok) setInfo("Preferences saved.");
  }

  async function addWebhook(e: React.FormEvent) {
    e.preventDefault(); if (!token) return;
    const res = await fetch(`${API}/api/webhooks-config`, {
      method: "POST", headers: authH(token),
      body: JSON.stringify({ url: wUrl, events: wEvents }),
    });
    const d = await res.json();
    if (res.ok) {
      setInfo(`Webhook created. Secret: ${d.secret} (save this now!)`);
      setWUrl(""); loadAll(token);
    }
  }

  async function deleteWebhook(id: string) {
    if (!token || !confirm("Delete this webhook?")) return;
    await fetch(`${API}/api/webhooks-config/${id}`, { method: "DELETE", headers: authH(token) });
    loadAll(token);
  }

  async function testWebhook(id: string) {
    if (!token) return;
    await fetch(`${API}/api/webhooks-config/${id}/test`, { method: "POST", headers: authH(token) });
    setInfo("Test ping dispatched — check your endpoint for delivery.");
  }

  async function disableTotp() {
    if (!token || !confirm("Disable two-factor authentication?")) return;
    await fetch(`${API}/api/auth/mfa/totp`, { method: "DELETE", headers: authH(token) });
    loadAll(token);
  }

  async function toggleEmailOtp(enable: boolean) {
    if (!token) return;
    const method = enable ? "POST" : "DELETE";
    await fetch(`${API}/api/auth/mfa/email-otp/enable`, { method, headers: authH(token) });
    loadAll(token);
  }

  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">Security & Notifications</h1>
      {info && <div className="bz-alert bz-alert--info">{info}</div>}

      {/* ── Security ──────────────────────────────────────────────────── */}
      <section className="bz-section">
        <h2 className="bz-section-title">Account Security</h2>

        <div className="bz-security-row">
          <div>
            <div className="bz-security-label">Authenticator App (TOTP)</div>
            <div className="bz-security-sub">
              Use Google Authenticator, Authy, or 1Password.
              {mfaStatus.totp_enabled
                ? " ✅ Enabled"
                : " Not enabled — add a second layer of protection."}
            </div>
          </div>
          {mfaStatus.totp_enabled
            ? <button className="bz-btn bz-btn--danger bz-btn--sm" onClick={disableTotp}>Disable</button>
            : <button className="bz-btn bz-btn--primary bz-btn--sm" onClick={() => setShowTotpSetup(true)}>
                Set up
              </button>
          }
        </div>

        <div className="bz-security-row" style={{marginTop:"12px"}}>
          <div>
            <div className="bz-security-label">Email OTP</div>
            <div className="bz-security-sub">
              Receive a one-time code by email at each login.
              {mfaStatus.email_otp_enabled ? " ✅ Enabled" : " Not enabled."}
            </div>
          </div>
          <label className="bz-toggle">
            <input type="checkbox" checked={mfaStatus.email_otp_enabled}
              onChange={e => toggleEmailOtp(e.target.checked)} />
            <span className="bz-toggle-track" />
          </label>
        </div>
      </section>

      {/* ── Email digest ─────────────────────────────────────────────── */}
      <section className="bz-section">
        <h2 className="bz-section-title">Email Notifications</h2>
        <div className="bz-prefs-grid">
          <label className="bz-toggle-row">
            <span>Weekly cash digest</span>
            <label className="bz-toggle">
              <input type="checkbox" checked={prefs.email_digest_enabled}
                onChange={e=>setPrefs(p=>({...p,email_digest_enabled:e.target.checked}))} />
              <span className="bz-toggle-track" />
            </label>
          </label>
          {prefs.email_digest_enabled && (
            <div className="bz-form bz-form--row" style={{marginTop:"10px"}}>
              <select className="bz-select" value={prefs.digest_cadence}
                onChange={e=>setPrefs(p=>({...p,digest_cadence:e.target.value}))}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              {prefs.digest_cadence==="weekly" && (
                <select className="bz-select" value={prefs.digest_day}
                  onChange={e=>setPrefs(p=>({...p,digest_day:parseInt(e.target.value)}))}>
                  {DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
                </select>
              )}
            </div>
          )}
          <label className="bz-toggle-row" style={{marginTop:"10px"}}>
            <span>Slack alerts</span>
            <label className="bz-toggle">
              <input type="checkbox" checked={prefs.slack_enabled}
                onChange={e=>setPrefs(p=>({...p,slack_enabled:e.target.checked}))} />
              <span className="bz-toggle-track" />
            </label>
          </label>
        </div>
        <button className="bz-btn bz-btn--primary" style={{marginTop:"16px"}} onClick={savePrefs}>
          Save preferences
        </button>
      </section>

      {/* ── Webhooks ─────────────────────────────────────────────────── */}
      <section className="bz-section">
        <h2 className="bz-section-title">Outbound Webhooks</h2>
        <p className="bz-section-sub">
          Receive signed HTTP POST requests when events occur.
          Each request includes an <code>X-ClearCash-Signature</code> header (HMAC-SHA256).
        </p>
        <form onSubmit={addWebhook} className="bz-form" style={{maxWidth:"560px"}}>
          <label className="bz-label">Endpoint URL</label>
          <input className="bz-input" type="url" placeholder="https://yourapp.com/webhooks"
            value={wUrl} onChange={e=>setWUrl(e.target.value)} required />
          <label className="bz-label" style={{marginTop:"12px"}}>Events to subscribe</label>
          <div className="bz-event-grid">
            {ALL_EVENTS.map(ev => (
              <label key={ev} className="bz-event-check">
                <input type="checkbox" checked={wEvents.includes(ev)}
                  onChange={e => setWEvents(es => e.target.checked ? [...es,ev] : es.filter(x=>x!==ev))} />
                <code>{ev}</code>
              </label>
            ))}
          </div>
          <button className="bz-btn bz-btn--primary" type="submit" style={{marginTop:"14px"}}>
            Add webhook
          </button>
        </form>

        {webhooks.length > 0 && (
          <table className="bz-table" style={{marginTop:"20px"}}>
            <thead><tr><th>URL</th><th>Events</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {webhooks.map((h:any) => (
                <tr key={h.id}>
                  <td className="bz-mono">{h.url.length>40?h.url.slice(0,40)+"…":h.url}</td>
                  <td>{JSON.parse(h.events||"[]").join(", ")}</td>
                  <td>{h.active ? "✅" : "⏸"}</td>
                  <td style={{display:"flex",gap:"6px"}}>
                    <button className="bz-btn bz-btn--ghost bz-btn--sm" onClick={()=>testWebhook(h.id)}>Test</button>
                    <button className="bz-btn bz-btn--danger bz-btn--sm" onClick={()=>deleteWebhook(h.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* TOTP Setup modal */}
      {showTotpSetup && token && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {/* Inline dynamic import to avoid circular deps */}
          <div className="totp-card" style={{position:"relative"}}>
            <button className="otp-close" onClick={()=>{setShowTotpSetup(false);loadAll(token);}}>✕</button>
            <p style={{padding:"40px 32px",color:"var(--ink-1)"}}>
              Open your account settings to set up 2FA via the TOTP Setup modal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
