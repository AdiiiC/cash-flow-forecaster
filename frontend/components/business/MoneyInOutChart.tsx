"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BizMoneyMonth } from "@/lib/businessView";
import { formatCurrency } from "@/lib/format";

function MoneyTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bz-tooltip">
      <div className="bz-tooltip-title">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="num" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(Number(entry.value ?? 0), currency)}
        </div>
      ))}
    </div>
  );
}

interface Props {
  data: BizMoneyMonth[];
  currency: string;
}

export function MoneyInOutChart({ data, currency }: Props) {
  return (
    <div style={{ width: "100%", height: 280 }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 8 }} barGap={6}>
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
        />
        <YAxis
          tickFormatter={(v) => formatCurrency(v, currency, true)}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={<MoneyTooltip currency={currency} />}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 8 }}
        />
        <Bar
          dataKey="moneyIn"
          name="Money in"
          fill="var(--pos)"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="moneyOut"
          name="Money out"
          fill="var(--neg)"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
