"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ForecastResponse } from "@/lib/api";
import { formatCurrency, formatWeekLabel } from "@/lib/format";

interface Row {
  period: string;
  p50: number;
  band: [number, number];
}

/** Projects the opening balance forward along the median net cash flow, with a
 *  band accumulated from the P10/P90 weekly net-flow bounds. */
function buildBalancePath(data: ForecastResponse): Row[] {
  const net = data.series.find((s) => s.name === "net_cash_flow");
  if (!net) return [];
  let mid = data.opening_balance;
  let lo = data.opening_balance;
  let hi = data.opening_balance;
  const rows: Row[] = [
    { period: data.as_of, p50: mid, band: [lo, hi] },
  ];
  for (const pt of net.forecast) {
    mid += pt.p50;
    lo += pt.p10;
    hi += pt.p90;
    rows.push({ period: pt.period, p50: mid, band: [lo, hi] });
  }
  return rows;
}

function BalanceTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div
      style={{
        background: "var(--ink-700)",
        border: "1px solid var(--line-strong)",
        borderRadius: 4,
        padding: "8px 10px",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--text-faint)" }}>{row.period}</div>
      <div className="num" style={{ marginTop: 4 }}>
        P50 {formatCurrency(row.p50, currency)}
      </div>
      <div className="num" style={{ color: "var(--text-muted)" }}>
        P10–P90 {formatCurrency(row.band[0], currency)} … {formatCurrency(row.band[1], currency)}
      </div>
    </div>
  );
}

export function BalanceChart({ data }: { data: ForecastResponse }) {
  const rows = buildBalancePath(data);
  const runwayPeriod =
    data.runway_weeks !== null ? rows[data.runway_weeks]?.period : undefined;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 8 }}>
        <XAxis
          dataKey="period"
          tickFormatter={formatWeekLabel}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          minTickGap={28}
        />
        <YAxis
          tickFormatter={(v) => formatCurrency(v, data.currency, true)}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<BalanceTooltip currency={data.currency} />} />
        <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="4 4" />
        {runwayPeriod && (
          <ReferenceLine
            x={runwayPeriod}
            stroke="var(--neg)"
            label={{ value: "runway", fill: "var(--neg)", fontSize: 11, position: "insideTopRight" }}
          />
        )}
        <Area
          dataKey="band"
          stroke="none"
          fill="var(--band)"
          isAnimationActive={false}
          activeDot={false}
        />
        <Line
          dataKey="p50"
          stroke="var(--pos)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
