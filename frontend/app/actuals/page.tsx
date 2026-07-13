"use client";
import { useEffect, useState } from "react";

import { API_BASE as API, safeFetch } from "@/lib/api";
const authH = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

interface Variance { week_start: string; actual_net: number; forecast_p50: number | null;
                     variance: number | null; variance_pct: number | null; status: string; }

export default function ActualsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [actuals, setActuals] = useState<any[]>([]);
  const [variance, setVariance] = useState<{ variance: Variance[]; cumulative_variance_pct?: number; reforecast_recommended?: boolean } | null>(null);
  const [form, setForm] = useState({ week_start: "", category: "", direction: "outflow", amount: "" });
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [tab, setTab] = useState<"entries" | "variance">("variance");

  useEffect(() => {
    const t = localStorage.getItem("cff.token");
    setToken(t); if (t) loadAll(t);
  }, []);

  async function loadAll(t: string) {
    const h = { headers: authH(t) };
    const [a, v] = await Promise.all([
      safeFetch(`${API}/api/cashflow-actuals`, h),
      safeFetch(`${API}/api/cashflow-actuals/variance`, h),
    ]);
    if (a) setActuals(a);
    if (v) setVariance(v);
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault(); if (!token) return;
    setLoading(true);
    const res = await fetch(`${API}/api/cashflow-actuals`, {
      method: "POST", headers: authH(token),
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) { setInfo("Entry saved."); setForm({ week_start: "", category: "", direction: "outflow", amount: "" }); loadAll(token); }
    setLoading(false);
  }

  async function uploadCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !token) return;
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`${API}/api/cashflow-actuals/upload`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    const d = await res.json();
    if (res.ok) { setInfo(`Imported ${d.rows_imported} rows.`); loadAll(token); }
  }

  const statusColor: Record<string,string> = { on_track:"var(--pos)", warning:"var(--amber,#f59e0b)", off_track:"var(--neg)" };

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">Actuals vs. Forecast</h1>
      <p className="bz-page-sub">
        Record what actually happened each week and compare it to your forecast.
        When cumulative variance exceeds 15%, consider re-running your forecast.
      </p>

      <div className="bz-tab-bar">
        <button className={`bz-tab${tab==="variance"?" bz-tab--active":""}`} onClick={()=>setTab("variance")}>Variance Analysis</button>
        <button className={`bz-tab${tab==="entries"?" bz-tab--active":""}`} onClick={()=>setTab("entries")}>All Entries</button>
      </div>

      {tab === "variance" && variance && (
        <>
          {variance.reforecast_recommended && (
            <div className="bz-alert bz-alert--warning">
              ⚠️ Cumulative variance is {variance.cumulative_variance_pct}% — consider re-running your forecast.
            </div>
          )}
          {variance.cumulative_variance_pct !== undefined && (
            <div className="bz-kpi-row">
              <div className="bz-kpi-mini">
                <span className="bz-kpi-label">Avg. Variance</span>
                <span className="bz-kpi-value">{variance.cumulative_variance_pct}%</span>
              </div>
            </div>
          )}
          <table className="bz-table">
            <thead><tr>
              <th>Week</th><th>Actual Net</th><th>Forecast P50</th>
              <th>Variance</th><th>Variance %</th><th>Status</th>
            </tr></thead>
            <tbody>
              {variance.variance.map(r => (
                <tr key={r.week_start}>
                  <td>{r.week_start}</td>
                  <td style={{color: r.actual_net>=0?"var(--pos)":"var(--neg)"}}>
                    {r.actual_net?.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0})}
                  </td>
                  <td>{r.forecast_p50 != null ? r.forecast_p50.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}) : "—"}</td>
                  <td style={{color: (r.variance??0)>=0?"var(--pos)":"var(--neg)"}}>
                    {r.variance != null ? `${r.variance>=0?"+":""}${r.variance.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0})}` : "—"}
                  </td>
                  <td>{r.variance_pct != null ? `${r.variance_pct}%` : "—"}</td>
                  <td><span style={{color: statusColor[r.status]||"inherit"}}>{r.status.replace("_"," ")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "entries" && (
        <>
          <div className="bz-upload-row">
            <label className="bz-btn bz-btn--ghost bz-btn--sm" style={{cursor:"pointer"}}>
              ⬆ Import CSV
              <input type="file" accept=".csv" hidden onChange={uploadCSV} />
            </label>
            <span className="bz-hint">CSV columns: date, category, direction, amount</span>
          </div>
          {info && <p className="bz-info">{info}</p>}
          <form onSubmit={addEntry} className="bz-form bz-form--row" style={{marginBottom:"20px"}}>
            <input className="bz-input" type="date" value={form.week_start} onChange={e=>setForm(f=>({...f,week_start:e.target.value}))} required />
            <input className="bz-input" placeholder="Category" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} required />
            <select className="bz-select" value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}>
              <option value="inflow">Inflow</option>
              <option value="outflow">Outflow</option>
            </select>
            <input className="bz-input" type="number" placeholder="Amount" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} min="0.01" step="0.01" required />
            <button className="bz-btn bz-btn--primary" type="submit" disabled={loading}>Add</button>
          </form>
          <table className="bz-table">
            <thead><tr><th>Week</th><th>Category</th><th>Direction</th><th>Amount</th><th>Source</th></tr></thead>
            <tbody>
              {actuals.map((a:any) => (
                <tr key={a.id}>
                  <td>{a.week_start}</td><td>{a.category}</td>
                  <td style={{color:a.direction==="inflow"?"var(--pos)":"var(--neg)"}}>{a.direction}</td>
                  <td>{a.amount?.toLocaleString()}</td><td>{a.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
