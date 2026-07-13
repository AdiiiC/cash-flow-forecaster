"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

export function ActualsCashFlowChart({ periods, currency }: Props) {
  const chartData = periods.map((p) => ({
    week: weekLabel(p.period_end),
    inflows: p.inflows,
    outflows: p.outflows,
  }));

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <XAxis dataKey="week" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={28} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatCurrency(v, currency, true)}
          />
          <Tooltip
            formatter={(v, name) => [
              formatCurrency(v as number, currency),
              name === "inflows" ? "Money in" : "Money out",
            ]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          />
          <Legend />
          <Bar dataKey="inflows" name="Money in" fill="var(--pos)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="outflows" name="Money out" fill="var(--neg)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
