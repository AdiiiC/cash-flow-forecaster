"use client";

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BizBalancePoint } from "@/lib/businessView";
import { formatCurrency, formatWeekLabel } from "@/lib/format";

interface Row {
  period: string;
  balance: number;
  range: [number, number];
}

function BalanceTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div className="bz-tooltip">
      <div className="bz-tooltip-title">{formatWeekLabel(row.period)}</div>
      <div className="num">Expected {formatCurrency(row.balance, currency)}</div>
      <div className="num bz-tooltip-muted">
        Likely range {formatCurrency(row.range[0], currency)} …{" "}
        {formatCurrency(row.range[1], currency)}
      </div>
    </div>
  );
}

interface Props {
  data: BizBalancePoint[];
  currency: string;
}

export function BizBalanceChart({ data, currency }: Props) {
  const rows: Row[] = data.map((d) => ({
    period: d.period,
    balance: d.balance,
    range: [d.worstCase, d.bestCase],
  }));

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
          tickFormatter={(v) => formatCurrency(v, currency, true)}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<BalanceTooltip currency={currency} />} />
        <Area
          dataKey="range"
          stroke="none"
          fill="var(--band)"
          isAnimationActive={false}
          activeDot={false}
        />
        <Line
          dataKey="balance"
          name="Expected"
          stroke="var(--pos)"
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
