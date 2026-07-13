"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, CartesianGrid } from "recharts";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "";
const authH = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
const fmt = (v: number) => `$${(v||0).toLocaleString("en-US",{maximumFractionDigits:0})}`;

export default function BurnRatePage() {
  const [token, setToken] = useState<string | null>(null);
  const [burn, setBurn] = useState<any>(null);
  const [bycat, setBycat] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [hcPlan, setHcPlan] = useState<any[]>([]);
  const [form, setForm] = useState({ name:"", department:"Engineering", annual_salary:"", hire_date:"", status:"active" });
  const [planForm, setPlanForm] = useState({ department:"", role:"", annual_salary:"", planned_start_date:"", type:"hire" });
  const [tab, setTab] = useState<"burn"|"headcount">("burn");
  const [info, setInfo] = useState("");

  useEffect(() => { const t = localStorage.getItem("cff.token"); setToken(t); if(t) load(t); }, []);

  async function load(t: string) {
    const [bRes, bcRes, eRes, hRes] = await Promise.all([
      fetch(`${API}/api/burn-rate`, { headers: authH(t) }),
      fetch(`${API}/api/burn-rate/by-category`, { headers: authH(t) }),
      fetch(`${API}/api/headcount`, { headers: authH(t) }),
      fetch(`${API}/api/headcount/plan`, { headers: authH(t) }),
    ]);
    if(bRes.ok)  setBurn(await bRes.json());
    if(bcRes.ok) setBycat(await bcRes.json());
    if(eRes.ok)  setEmployees(await eRes.json());
    if(hRes.ok)  setHcPlan(await hRes.json());
  }

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault(); if(!token) return;
    const res = await fetch(`${API}/api/headcount`, { method:"POST", headers:authH(token),
      body:JSON.stringify({...form, annual_salary:parseFloat(form.annual_salary)}) });
    if(res.ok) { setInfo("Employee added."); load(token); setForm({name:"",department:"Engineering",annual_salary:"",hire_date:"",status:"active"}); }
  }

  async function removeEmployee(id: string) {
    if(!token || !confirm("Remove employee?")) return;
    await fetch(`${API}/api/headcount/${id}`, { method:"DELETE", headers:authH(token) });
    load(token);
  }

  async function addPlan(e: React.FormEvent) {
    e.preventDefault(); if(!token) return;
    await fetch(`${API}/api/headcount/plan`, { method:"POST", headers:authH(token),
      body:JSON.stringify({...planForm, annual_salary:parseFloat(planForm.annual_salary)}) });
    load(token); setPlanForm({department:"",role:"",annual_salary:"",planned_start_date:"",type:"hire"});
  }

  const effColor: Record<string,string> = { efficient:"var(--pos)", moderate:"var(--accent,#f59e0b)", high:"var(--neg)" };
  const depts = [...new Set(employees.map(e=>e.department))];

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">Burn Rate & Headcount</h1>
      <div className="bz-tab-bar">
        <button className={`bz-tab${tab==="burn"?" bz-tab--active":""}`} onClick={()=>setTab("burn")}>Burn Rate</button>
        <button className={`bz-tab${tab==="headcount"?" bz-tab--active":""}`} onClick={()=>setTab("headcount")}>Headcount</button>
      </div>

      {tab === "burn" && burn && (
        <>
          <div className="bz-kpi-row" style={{flexWrap:"wrap"}}>
            {[
              {label:"Gross Burn / Month",  value:fmt(burn.gross_burn_monthly), help:"Total cash out per month"},
              {label:"Net Burn / Month",    value:fmt(burn.net_burn_monthly),   help:"Cash consumed after revenue"},
              {label:"Runway",              value:burn.runway_months ? `${burn.runway_months} mo` : "Solvent"},
              {label:"Active MRR",          value:fmt(burn.active_mrr)},
              {label:"Burn Multiple",       value:burn.burn_multiple != null ? `${burn.burn_multiple}x` : "—", help:"Net burn ÷ net new ARR. <1.5 = efficient"},
              {label:"Mo. to Profitability",value:burn.months_to_profitability != null ? `${burn.months_to_profitability} mo` : burn.net_burn_monthly <= 0 ? "Profitable" : "—"},
              {label:"Payroll / Week",      value:fmt(burn.payroll_weekly)},
              {label:"Recurring / Week",    value:fmt(burn.recurring_weekly)},
            ].map(({label,value,help}) => (
              <div key={label} className="bz-kpi-mini" title={help} style={{flex:"1 1 150px",minWidth:"150px"}}>
                <div className="bz-kpi-label">{label}</div>
                <div className="bz-kpi-value">{value}</div>
              </div>
            ))}
          </div>
          {burn.efficiency_rating && (
            <p style={{color: effColor[burn.efficiency_rating], fontWeight:700, marginTop:"12px"}}>
              Efficiency: {burn.efficiency_rating.toUpperCase()}
            </p>
          )}

          {bycat?.categories?.length > 0 && (
            <section className="bz-section" style={{marginTop:"28px"}}>
              <h2 className="bz-section-title">Burn by Category</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={bycat.categories} margin={{top:10,right:20,left:0,bottom:20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline,#262730)" />
                  <XAxis dataKey="category" tick={{fill:"var(--ink-3,#888)",fontSize:12}} angle={-30} textAnchor="end" />
                  <YAxis tick={{fill:"var(--ink-3,#888)",fontSize:12}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v:any)=>fmt(v)} contentStyle={{background:"var(--surface-2,#1e2130)",border:"1px solid var(--hairline,#262730)"}} />
                  <Bar dataKey="weekly_avg" name="Weekly Avg">
                    {bycat.categories.map((_:any, i:number) => (
                      <Cell key={i} fill={`hsl(${200+i*30},70%,55%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      )}

      {tab === "headcount" && (
        <>
          {info && <p className="bz-info">{info}</p>}
          <div className="bz-kpi-row">
            <div className="bz-kpi-mini"><div className="bz-kpi-label">Total Headcount</div><div className="bz-kpi-value">{employees.filter(e=>e.status==="active").length}</div></div>
            <div className="bz-kpi-mini"><div className="bz-kpi-label">Annual Payroll</div><div className="bz-kpi-value">{fmt(employees.filter(e=>e.status==="active").reduce((s,e)=>s+e.annual_salary,0))}</div></div>
            {depts.map(d => (
              <div key={d} className="bz-kpi-mini">
                <div className="bz-kpi-label">{d}</div>
                <div className="bz-kpi-value">{employees.filter(e=>e.department===d && e.status==="active").length} people</div>
              </div>
            ))}
          </div>

          <section className="bz-section">
            <h2 className="bz-section-title">Employee Roster</h2>
            <form onSubmit={addEmployee} className="bz-form bz-form--row" style={{marginBottom:"14px"}}>
              <input className="bz-input" placeholder="Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
              <input className="bz-input" placeholder="Department" value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} required />
              <input className="bz-input" type="number" placeholder="Annual Salary" value={form.annual_salary} onChange={e=>setForm(f=>({...f,annual_salary:e.target.value}))} required />
              <input className="bz-input" type="date" value={form.hire_date} onChange={e=>setForm(f=>({...f,hire_date:e.target.value}))} required />
              <button className="bz-btn bz-btn--primary" type="submit">Add</button>
            </form>
            <table className="bz-table">
              <thead><tr><th>Name</th><th>Department</th><th>Annual Salary</th><th>Weekly Cost</th><th>Hired</th><th></th></tr></thead>
              <tbody>
                {employees.filter(e=>e.status==="active").map((e:any) => (
                  <tr key={e.id}>
                    <td>{e.name}</td><td>{e.department}</td>
                    <td>{fmt(e.annual_salary)}</td><td>{fmt(e.weekly_cost)}</td>
                    <td>{e.hire_date}</td>
                    <td><button className="bz-btn bz-btn--danger bz-btn--sm" onClick={()=>removeEmployee(e.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="bz-section">
            <h2 className="bz-section-title">Hiring Plan</h2>
            <form onSubmit={addPlan} className="bz-form bz-form--row" style={{marginBottom:"14px"}}>
              <input className="bz-input" placeholder="Department" value={planForm.department} onChange={e=>setPlanForm(f=>({...f,department:e.target.value}))} required />
              <input className="bz-input" placeholder="Role" value={planForm.role} onChange={e=>setPlanForm(f=>({...f,role:e.target.value}))} required />
              <input className="bz-input" type="number" placeholder="Salary" value={planForm.annual_salary} onChange={e=>setPlanForm(f=>({...f,annual_salary:e.target.value}))} required />
              <input className="bz-input" type="date" value={planForm.planned_start_date} onChange={e=>setPlanForm(f=>({...f,planned_start_date:e.target.value}))} required />
              <select className="bz-select" value={planForm.type} onChange={e=>setPlanForm(f=>({...f,type:e.target.value}))}>
                <option value="hire">Hire</option>
                <option value="departure">Departure</option>
              </select>
              <button className="bz-btn bz-btn--primary" type="submit">Add</button>
            </form>
            <table className="bz-table">
              <thead><tr><th>Department</th><th>Role</th><th>Type</th><th>Start Date</th><th>Salary Impact</th></tr></thead>
              <tbody>
                {hcPlan.map((p:any) => (
                  <tr key={p.id}>
                    <td>{p.department}</td><td>{p.role}</td>
                    <td style={{color:p.type==="hire"?"var(--pos)":"var(--neg)"}}>{p.type}</td>
                    <td>{p.planned_start_date}</td>
                    <td>{p.type==="hire"?"+":"-"}{fmt(p.annual_salary)}/yr</td>
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
