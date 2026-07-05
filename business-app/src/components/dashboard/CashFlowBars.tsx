import type { JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CashFlowMonth } from "@/types";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { formatCurrency } from "@/lib/format";

interface CashFlowBarsProps {
  data: CashFlowMonth[];
  currency: string;
}

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

function CashFlowTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  currency: string;
}): JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="num text-slate-600">
          <span className="font-medium" style={{ color: entry.color }}>
            {entry.name}:
          </span>{" "}
          {formatCurrency(Number(entry.value ?? 0), currency)}
        </p>
      ))}
    </div>
  );
}

/** Grouped bars comparing money coming in vs money going out, per month. */
export function CashFlowBars({ data, currency }: CashFlowBarsProps): JSX.Element {
  return (
    <ChartCard
      title="Money in vs money out"
      subtitle="What you earn compared to what you spend, month by month"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => formatCurrency(value, currency, true)}
          />
          <Tooltip
            cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
            content={<CashFlowTooltip currency={currency} />}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 13, color: "#475569", paddingTop: 8 }}
          />
          <Bar dataKey="moneyIn" name="Money in" fill="#10b981" radius={[6, 6, 0, 0]} />
          <Bar dataKey="moneyOut" name="Money out" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
