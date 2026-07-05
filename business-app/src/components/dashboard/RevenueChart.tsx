import type { JSX } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RevenuePoint } from "@/types";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { formatCurrency } from "@/lib/format";

interface RevenueChartProps {
  data: RevenuePoint[];
  currency: string;
}

interface TooltipEntry {
  value?: number | string;
}

function RevenueTooltip({
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
      <p className="num text-slate-600">
        <span className="font-medium text-brand-600">Recurring revenue:</span>{" "}
        {formatCurrency(Number(payload[0]?.value ?? 0), currency)}
      </p>
    </div>
  );
}

/** Steady-growth area chart for monthly recurring revenue. */
export function RevenueChart({ data, currency }: RevenueChartProps): JSX.Element {
  return (
    <ChartCard
      title="Recurring revenue growth"
      subtitle="Your predictable monthly income, trending over time"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          <Tooltip content={<RevenueTooltip currency={currency} />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#4f46e5"
            strokeWidth={2.5}
            fill="url(#revFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
