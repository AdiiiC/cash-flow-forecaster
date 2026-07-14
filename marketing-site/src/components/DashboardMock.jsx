import React from 'react';
import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowUpRight, Sparkles, TrendingUp } from 'lucide-react';

// Deterministic cash-balance projection (12 months)
const data = [
  { d: 'Jan', v: 118 },
  { d: 'Feb', v: 132 },
  { d: 'Mar', v: 126 },
  { d: 'Apr', v: 148 },
  { d: 'May', v: 161 },
  { d: 'Jun', v: 172 },
  { d: 'Jul', v: 168 },
  { d: 'Aug', v: 189 },
  { d: 'Sep', v: 203 },
  { d: 'Oct', v: 219 },
  { d: 'Nov', v: 231 },
  { d: 'Dec', v: 246 },
];

export default function DashboardMock() {
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
        <span className="overline hidden sm:inline">P10 · P50 · P90</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 hairline-b">
        <Kpi label="Cash balance" value="$246,183" delta="+18.4%" positive />
        <Kpi label="Monthly burn" value="$41,220" delta="−4.1%" positive divider />
        <Kpi label="Runway" value="21.4 mo" delta="+2.3 mo" positive divider />
      </div>

      {/* Chart */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="overline">Projected cash · next 12 months</p>
            <p className="num text-[15px] mt-1 text-white">
              246,183 <span className="text-muted">USD</span>
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-positive">
            <TrendingUp size={13} />
            <span className="num">+108.6%</span>
          </div>
        </div>

        <div style={{ width: '100%', height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="tealFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2fb8a0" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2fb8a0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="d"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'ui-monospace' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide domain={[80, 280]} />
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
                stroke="#2fb8a0"
                strokeWidth={2}
                fill="url(#tealFill)"
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
          <p className="text-[12px] text-white">
            Runway extends by <span className="num text-positive">+2.3 months</span> under P50 scenario. Two USD invoices totalling <span className="num">$48,200</span> land Nov 14.
          </p>
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
