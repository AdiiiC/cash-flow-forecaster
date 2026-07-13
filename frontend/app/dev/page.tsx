"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dev-section">
      <h2 className="dev-section-title">{title}</h2>
      {children}
    </section>
  );
}

function Kv({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <div className="dev-kv">
      <span className="dev-kv-key">{k}</span>
      <span className="dev-kv-val">{v ?? "—"}</span>
    </div>
  );
}

export default function DevPage() {
  const [health, setHealth] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [payload, setPayload] = useState<string>("");
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("cff.token") ?? "" : "";
  const authH = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/api/health`).then(r => r.json()).then(setHealth).catch(() => {});
    if (token) {
      fetch(`${API}/api/runs?limit=5`, { headers: authH }).then(r => r.json()).then(setRuns).catch(() => {});
      fetch(`${API}/api/webhooks-config`, { headers: authH }).then(r => r.json()).then(setWebhooks).catch(() => {});
    }
  }, []);

  async function loadPayload(runId: string) {
    const r = await fetch(`${API}/api/runs/${runId}`, { headers: authH });
    const d = await r.json();
    setPayload(JSON.stringify(d, null, 2));
  }

  async function seedDemoData() {
    setSeedBusy(true); setSeedMsg("");
    try {
      const r = await fetch(`${API}/api/forecast/demo`, {
        method: "POST", headers: authH,
        body: JSON.stringify({ weeks: 52, seed: 42, currency: "USD" }),
      });
      const d = await r.json();
      setSeedMsg(`Demo run created: ${d.id ?? "ok"} · runway ${d.runway_weeks?.toFixed(0) ?? "∞"} wks`);
    } catch (e) { setSeedMsg("Failed: " + (e as Error).message); }
    setSeedBusy(false);
  }

  async function testEmail() {
    setEmailBusy(true); setEmailMsg("");
    try {
      const r = await fetch(`${API}/api/dev/test-email`, {
        method: "POST", headers: authH,
        body: JSON.stringify({ to: emailTo }),
      });
      setEmailMsg(r.ok ? "Test email dispatched." : `Failed: ${(await r.json()).detail}`);
    } catch (e) { setEmailMsg("Endpoint not yet wired — add POST /api/dev/test-email to backend."); }
    setEmailBusy(false);
  }

  return (
    <div className="dev-page">
      <header className="dev-header">
        <h1 className="dev-title">Dev Panel</h1>
        <a href="/dashboard" className="dev-back">← Dashboard</a>
        <a href="/docs" className="dev-link" target="_blank" rel="noopener">API Docs ↗</a>
      </header>

      {/* System health */}
      <Section title="System Health">
        {health ? (
          <div className="dev-grid">
            <Kv k="DB" v={health.db} />
            <Kv k="LLM provider" v={health.llm_provider} />
            <Kv k="LLM model" v={health.llm_model} />
            <Kv k="API base" v={API} />
            <Kv k="Auth token" v={token ? token.slice(0, 24) + "…" : "none"} />
          </div>
        ) : <p className="dev-empty">Loading health…</p>}
      </Section>

      {/* Seed data */}
      <Section title="Seed Demo Data">
        <p className="dev-hint">Fire a demo forecast against the backend and persist it to run history.</p>
        <button className="dev-btn" onClick={seedDemoData} disabled={seedBusy}>
          {seedBusy ? "Running…" : "Run demo forecast"}
        </button>
        {seedMsg && <p className="dev-msg">{seedMsg}</p>}
      </Section>

      {/* Recent runs */}
      <Section title="Recent Runs (last 5)">
        {runs.length === 0 ? (
          <p className="dev-empty">{token ? "No runs yet." : "Sign in to view runs."}</p>
        ) : (
          <table className="dev-table">
            <thead><tr><th>ID</th><th>Source</th><th>Created</th><th>Runway</th><th>Balance P50</th><th></th></tr></thead>
            <tbody>
              {runs.map((r: any) => (
                <tr key={r.id}>
                  <td className="dev-mono">{r.id}</td>
                  <td>{r.source}</td>
                  <td>{r.created_at?.slice(0, 16)}</td>
                  <td>{r.runway_weeks != null ? `${r.runway_weeks.toFixed(0)} wks` : "∞"}</td>
                  <td className="dev-mono">${r.projected_balance_p50?.toLocaleString()}</td>
                  <td><button className="dev-btn dev-btn-sm" onClick={() => loadPayload(r.id)}>Inspect</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {payload && (
          <details className="dev-payload">
            <summary>JSON payload</summary>
            <pre>{payload}</pre>
          </details>
        )}
      </Section>

      {/* Webhook status */}
      <Section title="Webhook Endpoints">
        {webhooks.length === 0 ? (
          <p className="dev-empty">{token ? "No webhooks configured." : "Sign in to view webhooks."}</p>
        ) : (
          <table className="dev-table">
            <thead><tr><th>URL</th><th>Events</th><th>Active</th></tr></thead>
            <tbody>
              {webhooks.map((h: any) => (
                <tr key={h.id}>
                  <td className="dev-mono">{h.url?.slice(0, 60)}</td>
                  <td>{JSON.parse(h.events || "[]").join(", ")}</td>
                  <td>{h.active ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Email test */}
      <Section title="Test Email (Resend)">
        <p className="dev-hint">Verify RESEND_API_KEY is working by sending a test email.</p>
        <div className="dev-row">
          <input
            className="dev-input"
            type="email"
            placeholder="recipient@example.com"
            value={emailTo}
            onChange={e => setEmailTo(e.target.value)}
          />
          <button className="dev-btn" onClick={testEmail} disabled={emailBusy || !emailTo}>
            {emailBusy ? "Sending…" : "Send test"}
          </button>
        </div>
        {emailMsg && <p className="dev-msg">{emailMsg}</p>}
      </Section>

      {/* Quick links */}
      <Section title="Quick Links">
        <div className="dev-links">
          <a href={`${API}/docs`} target="_blank" rel="noopener" className="dev-link-card">
            FastAPI Swagger<span>API docs ↗</span>
          </a>
          <a href={`${API}/redoc`} target="_blank" rel="noopener" className="dev-link-card">
            ReDoc<span>Alternative API docs ↗</span>
          </a>
          <a href="/forecast" className="dev-link-card">
            Forecast App<span>Probabilistic engine</span>
          </a>
          <a href="/actuals/config" className="dev-link-card">
            Actuals Config<span>Customer / supplier / GST / ExIm</span>
          </a>
          <a href="/settings/notifications" className="dev-link-card">
            Security Settings<span>MFA, webhooks, notifications</span>
          </a>
        </div>
      </Section>
    </div>
  );
}
