import type { JSX } from "react";
import {
  Area,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BalancePoint } from "@/types";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

interface BalanceChartProps {
  data: BalancePoint[];
  currency: string;
  confidenceLabel: string;
}

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

function BalanceTooltip({
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

/**
 * Projected cash-balance line chart. The p10/p90 band from the forecaster is
 * shown as a shaded "likely range" so non-technical users read uncertainty
 * without ever seeing a percentile.
 */
export function BalanceChart({
  data,
  currency,
  confidenceLabel,
}: BalanceChartProps): JSX.Element {
  return (
    <ChartCard
      title="Projected cash balance"
      subtitle="How much cash you'll have on hand over the next 13 weeks"
      action={<Badge tone="positive">{confidenceLabel}</Badge>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="rangeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value: number) => formatCurrency(value, currency, true)}
          />
          <Tooltip content={<BalanceTooltip currency={currency} />} />
          <Area
            type="monotone"
            dataKey="bestCase"
            name="Best case"
            stroke="none"
            fill="url(#rangeFill)"
          />
          <Area
            type="monotone"
            dataKey="worstCase"
            name="Worst case"
            stroke="none"
            fill="#ffffff"
          />
          <Line
            type="monotone"
            dataKey="balance"
            name="Expected"
            stroke="#4f46e5"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
