"use client";
import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowUpRight, Sparkles, TrendingUp } from 'lucide-react';

const SCENARIOS = [
  {
    label: 'Base',
    color: '#2fb8a0',
    fillId: 'tealFill',
    delta: '+108.6%',
    balance: '246,183',
    runway: '21.4 mo',
    burn: '$41,220',
    takeaway: 'Runway extends by +2.3 months under P50 scenario. Two USD invoices totalling $48,200 land Nov 14.',
    data: [
      { d: 'Jan', v: 118 }, { d: 'Feb', v: 132 }, { d: 'Mar', v: 126 },
      { d: 'Apr', v: 148 }, { d: 'May', v: 161 }, { d: 'Jun', v: 172 },
      { d: 'Jul', v: 168 }, { d: 'Aug', v: 189 }, { d: 'Sep', v: 203 },
      { d: 'Oct', v: 219 }, { d: 'Nov', v: 231 }, { d: 'Dec', v: 246 },
    ],
  },
  {
    label: 'Bull',
    color: '#e0a34a',
    fillId: 'amberFill',
    delta: '+192.4%',
    balance: '348,512',
    runway: '28.6 mo',
    burn: '$37,110',
    takeaway: 'Bull scenario: MRR growth +9%/mo sustains positive cash accretion through Dec. Runway risk: low.',
    data: [
      { d: 'Jan', v: 122 }, { d: 'Feb', v: 141 }, { d: 'Mar', v: 155 },
      { d: 'Apr', v: 178 }, { d: 'May', v: 198 }, { d: 'Jun', v: 214 },
      { d: 'Jul', v: 226 }, { d: 'Aug', v: 252 }, { d: 'Sep', v: 278 },
      { d: 'Oct', v: 302 }, { d: 'Nov', v: 325 }, { d: 'Dec', v: 348 },
    ],
  },
  {
    label: 'Bear',
    color: '#e0644f',
    fillId: 'rustFill',
    delta: '+28.1%',
    balance: '152,214',
    runway: '14.2 mo',
    burn: '$46,800',
    takeaway: 'Bear scenario: MRR growth stalls at +1%/mo. Runway at risk Q3. Consider 10–15% cost action by May.',
    data: [
      { d: 'Jan', v: 116 }, { d: 'Feb', v: 121 }, { d: 'Mar', v: 115 },
      { d: 'Apr', v: 122 }, { d: 'May', v: 128 }, { d: 'Jun', v: 119 },
      { d: 'Jul', v: 124 }, { d: 'Aug', v: 131 }, { d: 'Sep', v: 138 },
      { d: 'Oct', v: 142 }, { d: 'Nov', v: 148 }, { d: 'Dec', v: 152 },
    ],
  },
];

export default function DashboardMock() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    timerRef.current = setInterval(() => {
      setSceneIdx((i) => (i + 1) % SCENARIOS.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, []);

  const s = SCENARIOS[sceneIdx];

  return (
    <div
      className="bg-surface hairline rounded-card shadow-subtle overflow-hidden"
      data-testid="hero-dashboard-mock"
    >
      {/* Top bar */}
      <div className="hairline-b px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#2a3242]" />
          <div className="w-2 h-2 rounded-full bg-[#2a3242]" />
          <div className="w-2 h-2 rounded-full bg-[#2a3242]" />
          <span className="overline ml-3">clearcash / forecast · dec 2025</span>
        </div>
        {/* Scenario pills */}
        <div className="hidden sm:flex items-center gap-1">
          {SCENARIOS.map((sc, i) => (
            <button
              key={sc.label}
              onClick={() => { setSceneIdx(i); clearInterval(timerRef.current); }}
              className={`overline px-2 py-0.5 rounded transition-colors ${i === sceneIdx ? 'text-white' : 'text-muted hover:text-white'}`}
              style={i === sceneIdx ? { color: sc.color } : undefined}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 hairline-b">
        <Kpi label="Cash balance" value={`$${s.balance}`} delta={s.delta} positive={s.label !== 'Bear'} />
        <Kpi label="Monthly burn" value={s.burn} delta={s.label === 'Bull' ? '−9.9%' : s.label === 'Bear' ? '+2.1%' : '−4.1%'} positive={s.label !== 'Bear'} divider />
        <Kpi label="Runway" value={s.runway} delta={s.label === 'Bull' ? '+9.5 mo' : s.label === 'Bear' ? '−5.7 mo' : '+2.3 mo'} positive={s.label !== 'Bear'} divider />
      </div>

      {/* Chart */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="overline">Projected cash · next 12 months</p>
            <p className="num text-[15px] mt-1 text-white">
              {s.balance} <span className="text-muted">USD</span>
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[12px]" style={{ color: s.color }}>
            <TrendingUp size={13} />
            <span className="num">{s.delta}</span>
          </div>
        </div>

        <div style={{ width: '100%', height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="tealFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2fb8a0" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2fb8a0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="amberFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e0a34a" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#e0a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rustFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e0644f" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#e0644f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="d"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'ui-monospace' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide domain={[80, 380]} />
              <Tooltip
                contentStyle={{
                  background: '#171c27',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#ffffff',
                }}
                labelStyle={{ color: '#a1a1aa' }}
                cursor={{ stroke: '#e0a34a', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#${s.fillId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI takeaway */}
      <div className="hairline-t px-5 py-4 flex gap-3">
        <div className="w-7 h-7 shrink-0 rounded-btn bg-elevated hairline flex items-center justify-center">
          <Sparkles size={13} className="text-accent" />
        </div>
        <div>
          <p className="text-[12px] text-white">{s.takeaway}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
            <ArrowUpRight size={12} />
            <span>Review AI takeaways</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, positive, divider }) {
  return (
    <div className={`px-5 py-4 ${divider ? 'border-l border-[rgba(255,255,255,0.06)]' : ''}`}>
      <p className="overline">{label}</p>
      <p className="num text-[16px] sm:text-[17px] mt-1.5 text-white">{value}</p>
      <p className={`num text-[11.5px] mt-0.5 ${positive ? 'text-positive' : 'text-negative'}`}>
        {delta}
      </p>
    </div>
  );
}

