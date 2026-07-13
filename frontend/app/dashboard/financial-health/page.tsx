"use client";
import { useEffect, useState } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

import { API_BASE as API, safeFetch } from "@/lib/api";
const authH = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
const fmt = (v: number) => `$${(v||0).toLocaleString("en-US",{maximumFractionDigits:0})}`;

export default function FinancialHealthPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ratios, setRatios] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [cs, setCs] = useState<any>({ fixed_costs_weekly: 0, variable_cost_pct: 0, gross_margin_pct: 0.7, cac: null });
  const [beResult, setBeResult] = useState<any>(null);
  const [tab, setTab] = useState<"health"|"ratios"|"breakeven">("health");

  useEffect(() => { const t = localStorage.getItem("cff.token"); setToken(t); if(t) load(t); }, []);

  async function load(t: string) {
    const h = { headers: authH(t) };
    const [r, s, c] = await Promise.all([
      safeFetch(`${API}/api/financial-ratios`, h),
      safeFetch(`${API}/api/liquidity-score`, h),
      safeFetch(`${API}/api/financial-ratios/cost-structure`, h),
    ]);
    if (r) setRatios(r);
    if (s) setScore(s);
    if (c) setCs(c);
  }

  async function saveCs() {
    if(!token) return;
    await fetch(`${API}/api/financial-ratios/cost-structure`, { method:"POST", headers:authH(token), body:JSON.stringify(cs) });
    load(token);
  }

  async function calcBe() {
    if(!token) return;
    const body = {
      fixed_costs_weekly: cs.fixed_costs_weekly,
      variable_cost_pct: cs.variable_cost_pct,
      current_weekly_revenue: ratios?.active_mrr ? ratios.active_mrr * 12 / 52 : 0,
      weekly_revenue_growth_pct: 1.25,
    };
    const res = await fetch(`${API}/api/break-even/calculate`, { method:"POST", headers:authH(token), body:JSON.stringify(body) });
    if(res.ok) setBeResult(await res.json());
  }

  const scoreColor = (s: number) => s >= 80 ? "var(--pos)" : s >= 50 ? "var(--accent,#f59e0b)" : s >= 25 ? "#fb923c" : "var(--neg)";
  const ratingLabel: Record<string,string> = { strong:"Strong", adequate:"Adequate", at_risk:"At Risk", critical:"Critical" };

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">Financial Health</h1>
      <div className="bz-tab-bar">
        {(["health","ratios","breakeven"] as const).map(t => (
          <button key={t} className={`bz-tab${tab===t?" bz-tab--active":""}`} onClick={()=>setTab(t)}>
            {t==="health"?"Liquidity Score":t==="ratios"?"Financial Ratios":"Break-Even"}
          </button>
        ))}
      </div>

      {tab === "health" && score && (
        <>
          <div className="bz-score-ring-wrap">
            <div className="bz-score-ring" style={{borderColor: scoreColor(score.score)}}>
              <div className="bz-score-number" style={{color: scoreColor(score.score)}}>{score.score}</div>
              <div className="bz-score-label">{ratingLabel[score.rating]}</div>
            </div>
          </div>
          <p className="bz-peer-bench">{score.peer_benchmark}</p>
          <div className="bz-kpi-row" style={{flexWrap:"wrap",marginTop:"20px"}}>
            {Object.entries(score.components || {}).map(([k, v]: any) => (
              <div key={k} className="bz-kpi-mini" style={{flex:"1 1 140px"}}>
                <div className="bz-kpi-label">{k.replace("_"," ")} <span style={{color:"var(--ink-3,#888)"}}>/ {v.max}pts</span></div>
                <div className="bz-kpi-value" style={{fontSize:"1.1rem"}}>{v.score} pts</div>
                <div className="bz-kpi-sub">{v.value}</div>
              </div>
            ))}
          </div>
          <div className="bz-kpi-row" style={{marginTop:"16px"}}>
            <div className="bz-kpi-mini"><div className="bz-kpi-label">Cash on Hand</div><div className="bz-kpi-value">{fmt(score.cash_on_hand)}</div></div>
            <div className="bz-kpi-mini"><div className="bz-kpi-label">Reserve Target ({score.target_reserve_months} mo)</div><div className="bz-kpi-value">{fmt(score.reserve_target)}</div></div>
          </div>
        </>
      )}

      {tab === "ratios" && ratios && (
        <>
          <div className="bz-ratio-grid">
            {[
              { key:"current_ratio",  label:"Current Ratio",   value:`${ratios.current_ratio}x`,     bench: ratios.benchmarks?.current_ratio },
              { key:"quick_ratio",    label:"Quick Ratio",     value:`${ratios.quick_ratio}x`,       bench: ratios.benchmarks?.quick_ratio },
              { key:"gross_margin",   label:"Gross Margin",    value:`${ratios.gross_margin_pct}%`,  bench:null },
              { key:"net_margin",     label:"Net Margin",      value:`${ratios.net_margin_pct}%`,    bench:null },
              { key:"rule_of_40",     label:"Rule of 40",      value:ratios.rule_of_40 != null ? `${ratios.rule_of_40}` : "—", bench: ratios.benchmarks?.rule_of_40 },
              { key:"ltv_cac",        label:"LTV / CAC",       value:ratios.ltv_cac_ratio != null ? `${ratios.ltv_cac_ratio}x` : "—", bench: ratios.benchmarks?.ltv_cac_ratio },
              { key:"payback",        label:"CAC Payback",     value:ratios.payback_months != null ? `${ratios.payback_months} mo` : "—", bench: ratios.benchmarks?.payback_months },
            ].map(({ label, value, bench }) => (
              <div key={label} className="bz-ratio-card">
                <div className="bz-ratio-value" style={{color: bench ? (bench.ok ? "var(--pos)" : "var(--neg)") : "var(--ink-1,#f0f0f0)"}}>
                  {value}
                </div>
                <div className="bz-ratio-label">{label}</div>
                {bench && <div className="bz-ratio-bench">Target: {bench.good}</div>}
              </div>
            ))}
          </div>
          <section className="bz-section" style={{marginTop:"28px"}}>
            <h2 className="bz-section-title">Update Cost Structure</h2>
            <div className="bz-form" style={{maxWidth:"480px"}}>
              {[
                {key:"fixed_costs_weekly", label:"Weekly Fixed Costs ($)", type:"number"},
                {key:"variable_cost_pct",  label:"Variable Cost % of Revenue (0–1)", type:"number", step:"0.01"},
                {key:"gross_margin_pct",   label:"Gross Margin % (0–1)", type:"number", step:"0.01"},
                {key:"cac",               label:"Customer Acquisition Cost ($)", type:"number"},
              ].map(f => (
                <div key={f.key}>
                  <label className="bz-label">{f.label}</label>
                  <input className="bz-input" type={f.type} step={f.step} value={(cs as any)[f.key] ?? ""}
                    onChange={e => setCs((c:any)=>({...c, [f.key]: f.key==="cac" && !e.target.value ? null : parseFloat(e.target.value)||0}))} />
                </div>
              ))}
              <button className="bz-btn bz-btn--primary" style={{marginTop:"12px"}} onClick={saveCs}>Save</button>
            </div>
          </section>
        </>
      )}

      {tab === "breakeven" && (
        <>
          <p className="bz-section-sub">Break-even analysis uses your saved cost structure. Fill it in on the Ratios tab first.</p>
          <button className="bz-btn bz-btn--primary" onClick={calcBe}>Calculate Break-Even</button>
          {beResult && (
            <div className="bz-be-result">
              <div className="bz-kpi-row" style={{flexWrap:"wrap",marginTop:"20px"}}>
                {[
                  {label:"Break-even Revenue/Wk",  value:fmt(beResult.breakeven_weekly_revenue)},
                  {label:"Current Revenue/Wk",     value:fmt(beResult.current_weekly_revenue)},
                  {label:"Revenue Gap",            value:fmt(beResult.revenue_gap)},
                  {label:"Margin of Safety",        value:`${beResult.margin_of_safety_pct}%`},
                  {label:"Contribution Margin",    value:`${beResult.contribution_margin_pct}%`},
                  {label:"Weeks to Break-even",    value: beResult.above_breakeven ? "Already profitable" : beResult.weeks_to_breakeven ? `${beResult.weeks_to_breakeven} wks` : "N/A"},
                ].map(({label,value}) => (
                  <div key={label} className="bz-kpi-mini" style={{flex:"1 1 150px"}}>
                    <div className="bz-kpi-label">{label}</div>
                    <div className="bz-kpi-value" style={{fontSize:"1.1rem"}}>{value}</div>
                  </div>
                ))}
              </div>
              <div className={`bz-be-status ${beResult.above_breakeven?"bz-be-status--positive":"bz-be-status--negative"}`}>
                {beResult.above_breakeven ? "✅ Above break-even" : `⚠️ ${fmt(beResult.revenue_gap)}/week below break-even`}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
