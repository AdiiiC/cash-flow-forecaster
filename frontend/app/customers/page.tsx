"use client";
import { useEffect, useState } from "react";

import { API_BASE as API, safeFetch } from "@/lib/api";
const authH = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
const fmt = (v: number) => `$${(v||0).toLocaleString("en-US",{maximumFractionDigits:0})}`;

export default function CustomersPage() {
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [movement, setMovement] = useState<any>(null);
  const [churnRisk, setChurnRisk] = useState<any>(null);
  const [form, setForm] = useState({ name:"", arr:"", contract_start:"", contract_end:"", renewal_probability:"0.8", status:"active", billing_cycle:"monthly" });
  const [tab, setTab] = useState<"customers"|"mrr"|"risk">("mrr");
  const [info, setInfo] = useState("");

  useEffect(() => { const t = localStorage.getItem("cff.token"); setToken(t); if (t) load(t); }, []);

  async function load(t: string) {
    const h = { headers: authH(t) };
    const [c, m, r] = await Promise.all([
      safeFetch(`${API}/api/customers-mrr`, h),
      safeFetch(`${API}/api/customers-mrr/mrr-movement`, h),
      safeFetch(`${API}/api/customers-mrr/churn-risk`, h),
    ]);
    if (c) setCustomers(c);
    if (m) setMovement(m);
    if (r) setChurnRisk(r);
  }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault(); if (!token) return;
    const res = await fetch(`${API}/api/customers-mrr`, { method: "POST", headers: authH(token),
      body: JSON.stringify({ ...form, arr: parseFloat(form.arr), renewal_probability: parseFloat(form.renewal_probability) }) });
    if (res.ok) { setInfo("Customer added."); load(token); setForm(f => ({ ...f, name:"", arr:"", contract_start:"", contract_end:"" })); }
  }

  async function deleteCustomer(id: string) {
    if (!token || !confirm("Remove customer?")) return;
    await fetch(`${API}/api/customers-mrr/${id}`, { method: "DELETE", headers: authH(token) });
    load(token);
  }

  const statusColor: Record<string,string> = { active:"var(--pos)", at_risk:"var(--accent,#f59e0b)", churned:"var(--neg)" };

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">Customer Revenue</h1>
      <p className="bz-page-sub">Track ARR, MRR movement, and churn risk across your customer base.</p>

      <div className="bz-tab-bar">
        <button className={`bz-tab${tab==="mrr"?" bz-tab--active":""}`} onClick={()=>setTab("mrr")}>MRR Movement</button>
        <button className={`bz-tab${tab==="risk"?" bz-tab--active":""}`} onClick={()=>setTab("risk")}>Churn Risk</button>
        <button className={`bz-tab${tab==="customers"?" bz-tab--active":""}`} onClick={()=>setTab("customers")}>All Customers</button>
      </div>

      {tab === "mrr" && movement && (
        <>
          <div className="bz-kpi-row" style={{flexWrap:"wrap"}}>
            {[
              {label:"Total MRR",   value:fmt(movement.total_mrr)},
              {label:"Active MRR",  value:fmt(movement.active_mrr),  color:"var(--pos)"},
              {label:"At-Risk MRR", value:fmt(movement.at_risk_mrr), color:"var(--accent,#f59e0b)"},
              {label:"Churned MRR", value:fmt(movement.churned_mrr), color:"var(--neg)"},
              {label:"Net New MRR", value:fmt(movement.net_new_mrr), color:(movement.net_new_mrr||0)>=0?"var(--pos)":"var(--neg)"},
              {label:"Customers",   value:movement.customer_count},
            ].map(({label,value,color}:any) => (
              <div key={label} className="bz-kpi-mini" style={{flex:"1 1 130px"}}>
                <div className="bz-kpi-label">{label}</div>
                <div className="bz-kpi-value" style={color?{color}:{}}>{value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "risk" && churnRisk && (
        <>
          <div className="bz-kpi-row">
            <div className="bz-kpi-mini"><div className="bz-kpi-label">ARR at Risk</div><div className="bz-kpi-value" style={{color:"var(--neg)"}}>{fmt(churnRisk.arr_at_risk)}</div></div>
            <div className="bz-kpi-mini"><div className="bz-kpi-label">Customers at Risk</div><div className="bz-kpi-value">{churnRisk.at_risk?.length || 0}</div></div>
          </div>
          {churnRisk.at_risk?.length > 0 ? (
            <table className="bz-table" style={{marginTop:"16px"}}>
              <thead><tr><th>Customer</th><th>ARR</th><th>Contract End</th><th>Days Until Expiry</th><th>Renewal Prob.</th></tr></thead>
              <tbody>
                {churnRisk.at_risk.map((c:any,i:number)=>(
                  <tr key={i}>
                    <td>{c.name}</td><td>{fmt(c.arr)}</td><td>{c.contract_end}</td>
                    <td style={{color:c.days_until_expiry<30?"var(--neg)":c.days_until_expiry<60?"var(--accent,#f59e0b)":"inherit"}}>{c.days_until_expiry}d</td>
                    <td>{(c.renewal_probability*100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="bz-empty" style={{marginTop:"20px"}}>No contracts expiring within the forecast horizon. 🎉</p>}
        </>
      )}

      {tab === "customers" && (
        <>
          {info && <p className="bz-info">{info}</p>}
          <form onSubmit={addCustomer} className="bz-form bz-form--row" style={{marginBottom:"14px",flexWrap:"wrap"}}>
            <input className="bz-input" placeholder="Customer name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
            <input className="bz-input" type="number" placeholder="ARR ($)" value={form.arr} onChange={e=>setForm(f=>({...f,arr:e.target.value}))} required />
            <input className="bz-input" type="date" placeholder="Contract start" value={form.contract_start} onChange={e=>setForm(f=>({...f,contract_start:e.target.value}))} />
            <input className="bz-input" type="date" placeholder="Contract end" value={form.contract_end} onChange={e=>setForm(f=>({...f,contract_end:e.target.value}))} />
            <select className="bz-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              <option value="active">Active</option><option value="at_risk">At Risk</option><option value="churned">Churned</option>
            </select>
            <button className="bz-btn bz-btn--primary" type="submit">Add</button>
          </form>
          <table className="bz-table">
            <thead><tr><th>Customer</th><th>ARR</th><th>MRR</th><th>Contract End</th><th>Renewal %</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {customers.map((c:any)=>(
                <tr key={c.id}>
                  <td>{c.name}</td><td>{fmt(c.arr)}</td><td>{fmt(c.mrr)}</td>
                  <td>{c.contract_end||"—"}</td>
                  <td>{(c.renewal_probability*100).toFixed(0)}%</td>
                  <td><span style={{color:statusColor[c.status]||"inherit"}}>{c.status}</span></td>
                  <td><button className="bz-btn bz-btn--danger bz-btn--sm" onClick={()=>deleteCustomer(c.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
