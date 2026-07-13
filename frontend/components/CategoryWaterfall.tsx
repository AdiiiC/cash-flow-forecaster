"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CategoryFlow } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface BridgeBar {
  name: string;
  base: number;
  span: number;
  value: number;
  kind: "total" | "pos" | "neg";
}

function buildBridge(opening: number, categories: CategoryFlow[]): BridgeBar[] {
  const bars: BridgeBar[] = [{ name: "Opening", base: 0, span: opening, value: opening, kind: "total" }];
  let cum = opening;
  for (const c of categories) {
    const start = cum;
    cum += c.projected_total;
    bars.push({
      name: c.category,
      base: Math.min(start, cum),
      span: Math.abs(c.projected_total),
      value: c.projected_total,
      kind: c.projected_total >= 0 ? "pos" : "neg",
    });
  }
  bars.push({ name: "Projected", base: 0, span: cum, value: cum, kind: "total" });
  return bars;
}

const FILL: Record<string, string> = {
  total: "var(--accent)",
  pos: "var(--pos)",
  neg: "var(--neg)",
};

function WaterfallTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as BridgeBar;
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
      <div style={{ color: "var(--text-faint)" }}>{row.name}</div>
      <div className="num">
        {row.kind === "total" ? "" : row.value >= 0 ? "+" : ""}
        {formatCurrency(row.value, currency)}
      </div>
    </div>
  );
}

export function CategoryWaterfall({
  opening,
  categories,
  currency,
  horizonWeeks,
}: {
  opening: number;
  categories: CategoryFlow[];
  currency: string;
  horizonWeeks: number;
}) {
  if (!categories.length) return null;
  const bars = buildBridge(opening, categories);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Cash bridge by category</h3>
        <span className="badge">projected {horizonWeeks}w flows</span>
      </div>
      <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 8, right: 10, bottom: 0, left: 6 }}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={56}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency, true)}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip cursor={{ fill: "var(--band)" }} content={<WaterfallTooltip currency={currency} />} />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="span" stackId="w" isAnimationActive={false} radius={[2, 2, 0, 0]}>
            {bars.map((b, i) => (
              <Cell key={i} fill={FILL[b.kind]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      <div className="driver-note">
        Opening balance plus each category&apos;s projected horizon contribution.
        Inflows lift the bar, outflows draw it down, ending at projected cash.
      </div>
    </div>
  );
}
