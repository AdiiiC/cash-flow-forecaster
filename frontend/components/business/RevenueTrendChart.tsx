"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BizRevenuePoint } from "@/lib/businessView";
import { formatCurrency } from "@/lib/format";

function RevenueTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bz-tooltip">
      <div className="bz-tooltip-title">{label}</div>
      <div className="num">
        Recurring revenue {formatCurrency(Number(payload[0]?.value ?? 0), currency)}
      </div>
    </div>
  );
}

interface Props {
  data: BizRevenuePoint[];
  currency: string;
}

export function RevenueTrendChart({ data, currency }: Props) {
  return (
    <div style={{ width: "100%", height: 280 }}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="bzRevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
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
        <Tooltip content={<RevenueTooltip currency={currency} />} />
        <Area
          dataKey="revenue"
          stroke="var(--accent)"
          strokeWidth={2.5}
          fill="url(#bzRevFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}
