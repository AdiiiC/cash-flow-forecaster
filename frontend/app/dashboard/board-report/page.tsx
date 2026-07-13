"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from "recharts";

import { API_BASE as API } from "@/lib/api";
const authH = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
const fmt = (v: number) => `$${(v||0).toLocaleString("en-US",{maximumFractionDigits:0})}`;

export default function BoardReportPage() {
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [financing, setFinancing] = useState<any>(null);
  const [finImpact, setFinImpact] = useState<any>(null);
  const [taxEst, setTaxEst] = useState<any>(null);
  const [custConc, setCustConc] = useState<any>(null);
  const [vendConc, setVendConc] = useState<any>(null);
  const [arrWf, setArrWf] = useState<any>(null);
  const [capex, setCapex] = useState<any>(null);
  const [fcf, setFcf] = useState<any>(null);
  const [tab, setTab] = useState<"board"|"arr"|"capex"|"tax"|"risk"|"financing">("board");
  const [finForm, setFinForm] = useState({ type:"equity", label:"", expected_amount:"", probability_pct:"100", expected_date:"", status:"planned", notes:"" });

  useEffect(() => { const t = localStorage.getItem("cff.token"); setToken(t); if(t) load(t); }, []);

  async function load(t: string) {
    const results = await Promise.allSettled([
      fetch(`${API}/api/board-report`, { headers: authH(t) }),
      fetch(`${API}/api/financing`,    { headers: authH(t) }),
      fetch(`${API}/api/financing/impact`, { headers: authH(t) }),
      fetch(`${API}/api/tax/estimates`, { headers: authH(t) }),
      fetch(`${API}/api/concentration-risk/customers`, { headers: authH(t) }),
      fetch(`${API}/api/concentration-risk/vendors`,   { headers: authH(t) }),
      fetch(`${API}/api/arr-waterfall`, { headers: authH(t) }),
      fetch(`${API}/api/capex/schedule`,{ headers: authH(t) }),
      fetch(`${API}/api/capex/free-cash-flow`, { headers: authH(t) }),
    ]);
    const safe = async (r: PromiseSettledResult<Response>) => {
      if (r.status === "fulfilled" && r.value.ok) return r.value.json().catch(() => null);
      return null;
    };
    const [br,fi,fii,tx,cc,vc,aw,cx,fcfR] = await Promise.all(results.map(safe));
    if(br)  setReport(br);
    if(fi)  setFinancing(fi);
    if(fii) setFinImpact(fii);
    if(tx)  setTaxEst(tx);
    if(cc)  setCustConc(cc);
    if(vc)  setVendConc(vc);
    if(aw)  setArrWf(aw);
    if(cx)  setCapex(cx);
    if(fcfR)setFcf(fcfR);
  }

  async function addFinancing(e: React.FormEvent) {
    e.preventDefault(); if(!token) return;
    await fetch(`${API}/api/financing`, { method:"POST", headers:authH(token),
      body:JSON.stringify({...finForm, expected_amount:parseFloat(finForm.expected_amount), probability_pct:parseFloat(finForm.probability_pct)}) });
    load(token);
  }

  async function deleteFinancing(id: string) {
    if(!token) return;
    await fetch(`${API}/api/financing/${id}`, { method:"DELETE", headers:authH(token) });
    load(token);
  }

  const wfColors: Record<string,string> = { absolute:"var(--accent,#f59e0b)", positive:"var(--pos)", negative:"var(--neg)", total:"#636EFA" };
  const sevColor: Record<string,string> = { critical:"var(--neg)", warning:"var(--accent,#f59e0b)", info:"var(--ink-3,#888)" };

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">CFO Dashboard & Board Report</h1>
      <div className="bz-tab-bar" style={{flexWrap:"wrap"}}>
        {(["board","arr","capex","tax","risk","financing"] as const).map(t => (
          <button key={t} className={`bz-tab${tab===t?" bz-tab--active":""}`} onClick={()=>setTab(t)}>
            {t==="board"?"Board KPIs":t==="arr"?"ARR Waterfall":t==="capex"?"CapEx & FCF":t==="tax"?"Tax Estimates":t==="risk"?"Concentration Risk":"Financing"}
          </button>
        ))}
      </div>

      {/* Board KPIs */}
      {tab === "board" && report && (
        <>
          <div className="bz-report-date">As of {report.as_of} · {report.active_customers} active customers</div>
          <div className="bz-kpi-row" style={{flexWrap:"wrap"}}>
            {[
              {label:"Cash on Hand",      value:fmt(report.kpis.cash_on_hand)},
              {label:"Active MRR",        value:fmt(report.kpis.active_mrr)},
              {label:"Annual ARR",        value:fmt(report.kpis.total_arr)},
              {label:"Monthly Burn",      value:fmt(report.kpis.monthly_burn)},
              {label:"Runway",            value:report.kpis.runway_months ? `${report.kpis.runway_months} mo` : "Solvent"},
              {label:"Gross Margin",      value:`${report.kpis.gross_margin_pct}%`},
              {label:"Rule of 40",        value:report.kpis.rule_of_40 != null ? `${report.kpis.rule_of_40}` : "—"},
              {label:"Overdue AR",        value:fmt(report.kpis.overdue_ar)},
              {label:"Financing Pipeline",value:fmt(report.kpis.open_financing_pipeline)},
            ].map(({label,value}) => (
              <div key={label} className="bz-kpi-mini" style={{flex:"1 1 140px"}}>
                <div className="bz-kpi-label">{label}</div>
                <div className="bz-kpi-value">{value}</div>
              </div>
            ))}
          </div>
          {report.risks?.length > 0 && (
            <section className="bz-section" style={{marginTop:"24px"}}>
              <h2 className="bz-section-title">Key Risks</h2>
              {report.risks.map((r: any, i: number) => (
                <div key={i} className="bz-alert" style={{
                  background: r.severity==="critical"?"rgba(239,68,68,.1)":"rgba(245,158,11,.1)",
                  color: sevColor[r.severity], border:`1px solid ${sevColor[r.severity]}30`,
                  marginBottom:"8px"
                }}>
                  {r.severity === "critical" ? "🔴" : "🟡"} {r.message}
                </div>
              ))}
            </section>
          )}
          {report.history?.length > 1 && (
            <section className="bz-section">
              <h2 className="bz-section-title">Forecast History</h2>
              <table className="bz-table">
                <thead><tr><th>Label</th><th>Date</th><th>Projected Balance</th><th>Runway</th></tr></thead>
                <tbody>
                  {report.history.map((h:any) => (
                    <tr key={h.run_id}>
                      <td>{h.label}</td><td>{h.created_at?.slice(0,10)}</td>
                      <td>{fmt(h.projected_balance)}</td>
                      <td>{h.runway_weeks ? `${h.runway_weeks.toFixed(0)} wks` : "Solvent"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {/* ARR Waterfall */}
      {tab === "arr" && arrWf && (
        <>
          <div className="bz-kpi-row">
            {[
              {label:"Total MRR",    value:fmt(arrWf.total_mrr)},
              {label:"Net New MRR",  value:fmt(arrWf.net_new_mrr), color:(arrWf.net_new_mrr||0)>=0?"var(--pos)":"var(--neg)"},
              {label:"Churn Rate",   value:`${arrWf.churn_rate_pct}%`},
              {label:"Customers",    value:arrWf.customer_count},
            ].map(({label,value,color}:any) => (
              <div key={label} className="bz-kpi-mini" style={{flex:"1 1 130px"}}>
                <div className="bz-kpi-label">{label}</div>
                <div className="bz-kpi-value" style={color?{color}:{}}>{value}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={arrWf.waterfall} margin={{top:10,right:20,left:0,bottom:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline,#262730)" />
              <XAxis dataKey="label" tick={{fill:"var(--ink-3,#888)",fontSize:12}} />
              <YAxis tick={{fill:"var(--ink-3,#888)",fontSize:12}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v:any)=>fmt(v)} contentStyle={{background:"var(--surface-2,#1e2130)",border:"1px solid var(--hairline,#262730)"}} />
              <Bar dataKey="value" name="MRR ($)">
                {arrWf.waterfall?.map((r:any,i:number) => <Cell key={i} fill={wfColors[r.type]||"#636EFA"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {/* CapEx & FCF */}
      {tab === "capex" && (
        <>
          {capex && (
            <div className="bz-kpi-row">
              {[
                {label:"Weekly Depreciation", value:fmt(capex.total_weekly_depreciation)},
                {label:"Annual Depreciation",  value:fmt(capex.total_annual_depreciation)},
                {label:"Total Book Value",     value:fmt(capex.total_net_book_value)},
              ].map(({label,value}) => <div key={label} className="bz-kpi-mini"><div className="bz-kpi-label">{label}</div><div className="bz-kpi-value">{value}</div></div>)}
            </div>
          )}
          {fcf?.weekly_rows?.length > 0 && (
            <section className="bz-section" style={{marginTop:"24px"}}>
              <h2 className="bz-section-title">Free Cash Flow = Operating CF − CapEx</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={fcf.weekly_rows} margin={{top:10,right:20,left:0,bottom:10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline,#262730)" />
                  <XAxis dataKey="period" tick={{fill:"var(--ink-3,#888)",fontSize:11}} interval={3} />
                  <YAxis tick={{fill:"var(--ink-3,#888)",fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v:any)=>fmt(v)} contentStyle={{background:"var(--surface-2,#1e2130)",border:"1px solid var(--hairline,#262730)"}} />
                  <Line dataKey="op_cf_p50" name="Operating CF" stroke="#636EFA" strokeWidth={2} dot={false} />
                  <Line dataKey="fcf" name="Free CF" stroke="var(--pos)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      )}

      {/* Tax Estimates */}
      {tab === "tax" && taxEst && (
        <>
          <div className="bz-kpi-row">
            {[
              {label:"Taxable Income (Est.)",  value:fmt(taxEst.estimated_annual_taxable_income)},
              {label:"Effective Rate",          value:`${taxEst.effective_tax_rate_pct}%`},
              {label:"Annual Tax Est.",         value:fmt(taxEst.estimated_annual_tax)},
              {label:"Quarterly Payment",       value:fmt(taxEst.quarterly_estimate)},
              {label:"Safe Harbor Qtrly",       value:fmt(taxEst.safe_harbor_quarterly)},
            ].map(({label,value}) => (
              <div key={label} className="bz-kpi-mini" style={{flex:"1 1 140px"}}><div className="bz-kpi-label">{label}</div><div className="bz-kpi-value">{value}</div></div>
            ))}
          </div>
          <h2 className="bz-section-title" style={{marginTop:"24px"}}>Payment Schedule</h2>
          <table className="bz-table">
            <thead><tr><th>Due Date</th><th>Payment (Est.)</th><th>Safe Harbor</th><th>Pay Higher Of</th><th>Days Until</th></tr></thead>
            <tbody>
              {taxEst.payment_schedule?.map((p:any,i:number) => (
                <tr key={i}>
                  <td>{p.due_date}</td>
                  <td>{fmt(p.amount)}</td>
                  <td>{fmt(p.safe_harbor)}</td>
                  <td style={{fontWeight:700}}>{fmt(p.pay_higher_of)}</td>
                  <td style={{color:p.days_until<0?"var(--neg)":p.days_until<30?"var(--accent,#f59e0b)":"var(--pos)"}}>{p.days_until >= 0 ? `${p.days_until}d` : "Past"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Concentration Risk */}
      {tab === "risk" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px"}}>
          {custConc && !custConc.message && (
            <section className="bz-section">
              <h2 className="bz-section-title">Customer Concentration</h2>
              <div className="bz-kpi-row">
                <div className="bz-kpi-mini"><div className="bz-kpi-label">Top 3 ARR %</div><div className="bz-kpi-value">{custConc.top_3_arr_pct}%</div></div>
                <div className="bz-kpi-mini"><div className="bz-kpi-label">HHI Score</div><div className="bz-kpi-value">{custConc.hhi}</div></div>
                <div className="bz-kpi-mini"><div className="bz-kpi-label">Rating</div><div className="bz-kpi-value" style={{color:custConc.hhi>2500?"var(--neg)":custConc.hhi>1500?"var(--accent,#f59e0b)":"var(--pos)"}}>{custConc.concentration_label}</div></div>
              </div>
              {custConc.cliff_risk && <div className="bz-alert bz-alert--warning">⚠️ A customer holds &gt;25% of ARR</div>}
              <table className="bz-table"><thead><tr><th>Customer</th><th>ARR</th><th>% of Total</th></tr></thead>
                <tbody>{custConc.top_customers?.map((c:any,i:number)=><tr key={i}><td>{c.name}</td><td>{fmt(c.arr)}</td><td>{c.arr_pct}%</td></tr>)}</tbody>
              </table>
            </section>
          )}
          {vendConc && !vendConc.message && (
            <section className="bz-section">
              <h2 className="bz-section-title">Vendor Concentration</h2>
              <div className="bz-kpi-row">
                <div className="bz-kpi-mini"><div className="bz-kpi-label">Top 3 Spend %</div><div className="bz-kpi-value">{vendConc.top_3_spend_pct}%</div></div>
                <div className="bz-kpi-mini"><div className="bz-kpi-label">HHI</div><div className="bz-kpi-value">{vendConc.hhi}</div></div>
                <div className="bz-kpi-mini"><div className="bz-kpi-label">Rating</div><div className="bz-kpi-value" style={{color:vendConc.hhi>2500?"var(--neg)":vendConc.hhi>1500?"var(--accent,#f59e0b)":"var(--pos)"}}>{vendConc.concentration_label}</div></div>
              </div>
              <table className="bz-table"><thead><tr><th>Vendor</th><th>Spend</th><th>% of Total</th></tr></thead>
                <tbody>{vendConc.top_vendors?.map((v:any,i:number)=><tr key={i}><td>{v.name}</td><td>{fmt(v.spend)}</td><td>{v.pct}%</td></tr>)}</tbody>
              </table>
            </section>
          )}
        </div>
      )}

      {/* Financing */}
      {tab === "financing" && (
        <>
          {finImpact && (
            <div className="bz-kpi-row">
              {[
                {label:"Base Case Runway",     value:`${finImpact.base_case_runway} mo`},
                {label:"Expected Case Runway", value:`${finImpact.expected_case_runway} mo`},
                {label:"Best Case Runway",     value:`${finImpact.best_case_runway} mo`},
                {label:"Weighted Inflow",      value:fmt(finImpact.weighted_inflow)},
              ].map(({label,value}) => (
                <div key={label} className="bz-kpi-mini" style={{flex:"1 1 140px"}}><div className="bz-kpi-label">{label}</div><div className="bz-kpi-value">{value}</div></div>
              ))}
            </div>
          )}
          <section className="bz-section" style={{marginTop:"24px"}}>
            <h2 className="bz-section-title">Add Financing Event</h2>
            <form onSubmit={addFinancing} className="bz-form bz-form--row" style={{flexWrap:"wrap"}}>
              <select className="bz-select" value={finForm.type} onChange={e=>setFinForm(f=>({...f,type:e.target.value}))}>
                {["equity","loan","credit_draw","grant","revenue_based","convertible"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <input className="bz-input" placeholder="Label (e.g. Series A)" value={finForm.label} onChange={e=>setFinForm(f=>({...f,label:e.target.value}))} required />
              <input className="bz-input" type="number" placeholder="Amount ($)" value={finForm.expected_amount} onChange={e=>setFinForm(f=>({...f,expected_amount:e.target.value}))} required />
              <input className="bz-input" type="number" placeholder="Probability %" value={finForm.probability_pct} onChange={e=>setFinForm(f=>({...f,probability_pct:e.target.value}))} />
              <input className="bz-input" type="date" value={finForm.expected_date} onChange={e=>setFinForm(f=>({...f,expected_date:e.target.value}))} required />
              <select className="bz-select" value={finForm.status} onChange={e=>setFinForm(f=>({...f,status:e.target.value}))}>
                <option value="planned">Planned</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className="bz-btn bz-btn--primary" type="submit">Add</button>
            </form>
            <table className="bz-table" style={{marginTop:"14px"}}>
              <thead><tr><th>Type</th><th>Label</th><th>Amount</th><th>Probability</th><th>Expected Date</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {(finImpact?.events || []).map((e:any) => (
                  <tr key={e.id}>
                    <td>{e.type}</td><td>{e.label}</td><td>{fmt(e.expected_amount)}</td>
                    <td>{e.probability_pct}%</td><td>{e.expected_date}</td>
                    <td><span style={{color:e.status==="closed"?"var(--pos)":e.status==="cancelled"?"var(--neg)":"var(--ink-3,#888)"}}>{e.status}</span></td>
                    <td><button className="bz-btn bz-btn--danger bz-btn--sm" onClick={()=>deleteFinancing(e.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
