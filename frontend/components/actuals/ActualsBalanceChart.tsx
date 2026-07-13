"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ProjectionPeriod } from "@/lib/actualsApi";

function weekLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  periods: ProjectionPeriod[];
  currency: string;
}

export function ActualsBalanceChart({ periods, currency }: Props) {
  const chartData = periods.map((p) => ({
    week: weekLabel(p.period_end),
    balance: p.closing_balance,
  }));

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="week" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={28} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatCurrency(v, currency, true)}
          />
          <Tooltip
            formatter={(v) => [formatCurrency(v as number, currency), "Balance"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          />
          <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="4 2" />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--accent)"
            fill="url(#balGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
