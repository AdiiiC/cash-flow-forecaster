"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { API_BASE as API, safeFetch } from "@/lib/api";
const authH = (t: string) => ({ Authorization: `Bearer ${t}` });

export default function WorkingCapitalPage() {
  const [token, setToken] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [arAging, setArAging] = useState<any>(null);
  const [apAging, setApAging] = useState<any>(null);
  const [tab, setTab] = useState<"overview" | "ar" | "ap">("overview");

  useEffect(() => {
    const t = localStorage.getItem("cff.token");
    setToken(t); if (t) load(t);
  }, []);

  async function load(t: string) {
    const h = { headers: authH(t) };
    const [m, ar, ap] = await Promise.all([
      safeFetch(`${API}/api/working-capital/metrics`, h),
      safeFetch(`${API}/api/working-capital/ar-aging`, h),
      safeFetch(`${API}/api/working-capital/ap-aging`, h),
    ]);
    if (m)  setMetrics(m);
    if (ar) setArAging(ar);
    if (ap) setApAging(ap);
  }

  const fmt = (v: number) => v?.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const healthColor: Record<string,string> = { strong: "var(--pos)", adequate: "var(--accent,#f59e0b)", at_risk: "var(--neg)" };

  if (!token) return <div className="bz-page"><p className="bz-empty">Sign in to view working capital.</p></div>;

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">Working Capital</h1>
      <p className="bz-page-sub">Track cash collection speed (DSO), payment timing (DPO), and overdue receivables.</p>

      <div className="bz-tab-bar">
        {["overview","ar","ap"].map(t => (
          <button key={t} className={`bz-tab${tab===t?" bz-tab--active":""}`} onClick={()=>setTab(t as any)}>
            {t==="overview"?"Overview":t==="ar"?"AR Aging":"AP Schedule"}
          </button>
        ))}
      </div>

      {tab === "overview" && metrics && (
        <>
          <div className="bz-kpi-row" style={{flexWrap:"wrap",gap:"12px"}}>
            {[
              { label:"Days Sales Outstanding (DSO)", value:`${metrics.dso_days} days`, help:"How long customers take to pay you. Lower is better." },
              { label:"Days Payable Outstanding (DPO)", value:`${metrics.dpo_days} days`, help:"How long you take to pay suppliers. Higher = more cash retained." },
              { label:"Cash Conversion Cycle", value:`${metrics.cash_conversion_cycle} days`, help:"DSO − DPO. Negative = you collect before you pay (ideal)." },
              { label:"Total AR",   value:fmt(metrics.total_ar),   help:"Outstanding receivables owed to you." },
              { label:"Total AP",   value:fmt(metrics.total_ap),   help:"Outstanding payables you owe vendors." },
              { label:"Overdue AR >60d", value:fmt(metrics.overdue_ar_60d), help:"Receivables more than 60 days past due — collection risk." },
              { label:"Current Ratio", value:`${metrics.current_ratio}x`, help:"Assets/liabilities. >2 = strong, <1 = at risk." },
              { label:"Quick Ratio",   value:`${metrics.quick_ratio}x`,   help:"Cash + near-term AR / near-term AP. >1 = healthy." },
            ].map(({ label, value, help }) => (
              <div key={label} className="bz-kpi-mini" title={help} style={{minWidth:"160px",flex:"1 1 160px"}}>
                <div className="bz-kpi-label">{label}</div>
                <div className="bz-kpi-value">{value}</div>
              </div>
            ))}
          </div>
          <div className="bz-health-badge" style={{color: healthColor[metrics.health||"adequate"],marginTop:"16px"}}>
            Health: {metrics.health?.replace("_"," ").toUpperCase()}
          </div>
        </>
      )}

      {tab === "ar" && arAging && (
        <>
          <div className="bz-kpi-row">
            {Object.entries(arAging.summary || {}).map(([k,v]: any) => (
              <div key={k} className="bz-kpi-mini" style={{flex:"1 1 120px"}}>
                <div className="bz-kpi-label">{k.replace("_"," ")} days</div>
                <div className="bz-kpi-value">{fmt(v.total)}</div>
                <div className="bz-kpi-sub">{v.count} invoices</div>
              </div>
            ))}
          </div>
          <table className="bz-table" style={{marginTop:"16px"}}>
            <thead><tr><th>Counterparty</th><th>Amount</th><th>Due Date</th><th>Days Overdue</th><th>Bucket</th></tr></thead>
            <tbody>
              {(arAging.rows || []).map((r: any) => (
                <tr key={r.invoice_id}>
                  <td>{r.counterparty}</td>
                  <td>{fmt(r.amount)}</td>
                  <td>{r.due_date}</td>
                  <td style={{color: r.days_overdue > 60 ? "var(--neg)" : r.days_overdue > 30 ? "var(--accent,#f59e0b)" : "inherit"}}>
                    {r.days_overdue}d
                  </td>
                  <td>{r.bucket.replace("_"," ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "ap" && apAging && (
        <table className="bz-table">
          <thead><tr><th>Vendor</th><th>Amount</th><th>Due Date</th><th>Days Until Due</th><th>Urgency</th></tr></thead>
          <tbody>
            {(apAging.rows || []).map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.counterparty}</td>
                <td>{fmt(r.amount)}</td>
                <td>{r.due_date}</td>
                <td style={{color: r.urgency==="overdue"?"var(--neg)":r.urgency==="due_soon"?"var(--accent,#f59e0b)":"inherit"}}>
                  {r.days_until_due >= 0 ? `${r.days_until_due}d` : `${Math.abs(r.days_until_due)}d overdue`}
                </td>
                <td>{r.urgency.replace("_"," ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
