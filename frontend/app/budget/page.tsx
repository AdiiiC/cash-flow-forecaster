"use client";
import { useEffect, useState } from "react";

import { API_BASE as API, safeFetch } from "@/lib/api";
const authH = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
const fmt = (v: number) => `$${(v||0).toLocaleString("en-US",{maximumFractionDigits:0})}`;

export default function BudgetPage() {
  const [token, setToken] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [variance, setVariance] = useState<any>(null);
  const [form, setForm] = useState({ fiscal_year: new Date().getFullYear(), category: "", direction: "outflow", weekly_amount: "", label: "" });
  const [tab, setTab] = useState<"lines"|"variance">("variance");
  const [info, setInfo] = useState("");

  useEffect(() => { const t = localStorage.getItem("cff.token"); setToken(t); if (t) load(t); }, []);

  async function load(t: string) {
    const h = { headers: authH(t) };
    const [b, v] = await Promise.all([
      safeFetch(`${API}/api/budget`, h),
      safeFetch(`${API}/api/budget/variance`, h),
    ]);
    if (b) setBudgets(b);
    if (v) setVariance(v);
  }

  async function addLine(e: React.FormEvent) {
    e.preventDefault(); if (!token) return;
    const res = await fetch(`${API}/api/budget`, { method: "POST", headers: authH(token),
      body: JSON.stringify({ ...form, weekly_amount: parseFloat(form.weekly_amount) }) });
    if (res.ok) { setInfo("Budget line added."); load(token); setForm(f => ({ ...f, category: "", weekly_amount: "", label: "" })); }
  }

  async function deleteLine(id: string) {
    if (!token) return;
    await fetch(`${API}/api/budget/${id}`, { method: "DELETE", headers: authH(token) });
    load(token);
  }

  async function uploadCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !token) return;
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`${API}/api/budget/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    const d = await res.json();
    if (res.ok) { setInfo(`Imported ${d.rows_imported} budget lines.`); load(token); }
  }

  const statusColor: Record<string,string> = { on_budget: "var(--pos)", warning: "var(--accent,#f59e0b)", over_budget: "var(--neg)" };

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">Budget Management</h1>
      <p className="bz-page-sub">Set your annual budget by category and compare it against your forecast and actuals.</p>

      <div className="bz-tab-bar">
        <button className={`bz-tab${tab==="variance"?" bz-tab--active":""}`} onClick={()=>setTab("variance")}>Budget vs Forecast</button>
        <button className={`bz-tab${tab==="lines"?" bz-tab--active":""}`} onClick={()=>setTab("lines")}>Budget Lines</button>
      </div>

      {tab === "variance" && variance && (
        <>
          {variance.message && <p className="bz-empty">{variance.message}</p>}
          {variance.rows?.length > 0 && (
            <table className="bz-table">
              <thead><tr><th>Category</th><th>Direction</th><th>Budgeted/Wk</th><th>Forecast/Wk</th><th>Actual/Wk</th><th>Forecast vs Budget</th><th>Status</th></tr></thead>
              <tbody>
                {variance.rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.category}</td>
                    <td style={{color:r.direction==="inflow"?"var(--pos)":"var(--neg)"}}>{r.direction}</td>
                    <td>{fmt(r.budgeted_weekly)}</td>
                    <td>{fmt(r.forecast_weekly)}</td>
                    <td>{fmt(r.actual_weekly)}</td>
                    <td style={{color:(r.forecast_vs_budget_pct||0)>0?"var(--neg)":"var(--pos)"}}>
                      {r.forecast_vs_budget_pct > 0 ? "+" : ""}{r.forecast_vs_budget_pct}%
                    </td>
                    <td><span style={{color:statusColor[r.status]||"inherit"}}>{r.status.replace("_"," ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "lines" && (
        <>
          {info && <p className="bz-info">{info}</p>}
          <div className="bz-upload-row">
            <label className="bz-btn bz-btn--ghost bz-btn--sm" style={{cursor:"pointer"}}>
              ⬆ Import CSV <input type="file" accept=".csv" hidden onChange={uploadCSV} />
            </label>
            <span className="bz-hint">CSV: fiscal_year, category, direction, weekly_amount, label</span>
          </div>
          <form onSubmit={addLine} className="bz-form bz-form--row" style={{marginBottom:"14px",flexWrap:"wrap"}}>
            <input className="bz-input" type="number" placeholder="Year" value={form.fiscal_year} onChange={e=>setForm(f=>({...f,fiscal_year:parseInt(e.target.value)}))} style={{width:"80px"}} required />
            <input className="bz-input" placeholder="Category" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} required />
            <select className="bz-select" value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}>
              <option value="outflow">Outflow</option><option value="inflow">Inflow</option>
            </select>
            <input className="bz-input" type="number" placeholder="Weekly amount ($)" value={form.weekly_amount} onChange={e=>setForm(f=>({...f,weekly_amount:e.target.value}))} required />
            <input className="bz-input" placeholder="Label (optional)" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} />
            <button className="bz-btn bz-btn--primary" type="submit">Add</button>
          </form>
          <table className="bz-table">
            <thead><tr><th>Year</th><th>Category</th><th>Direction</th><th>Weekly Amount</th><th>Label</th><th></th></tr></thead>
            <tbody>
              {budgets.map((b:any)=>(
                <tr key={b.id}>
                  <td>{b.fiscal_year}</td><td>{b.category}</td>
                  <td style={{color:b.direction==="inflow"?"var(--pos)":"var(--neg)"}}>{b.direction}</td>
                  <td>{fmt(b.weekly_amount)}</td><td>{b.label||"—"}</td>
                  <td><button className="bz-btn bz-btn--danger bz-btn--sm" onClick={()=>deleteLine(b.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
