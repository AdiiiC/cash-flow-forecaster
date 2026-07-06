"use client";

import { formatCurrency } from "@/lib/format";
import type { DeterministicProjection } from "@/lib/actualsApi";

function monthLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActualsKpis({ data }: { data: DeterministicProjection }) {
  const runwayLabel =
    data.runway_weeks === null
      ? `${data.periods.length}+ weeks`
      : `${data.runway_weeks} weeks`;

  const kpis = [
    {
      label: "Opening balance",
      value: formatCurrency(data.opening_balance, data.currency),
      hint: "Cash on hand at the start of the projection",
    },
    {
      label: "Closing balance",
      value: formatCurrency(data.closing_balance, data.currency),
      hint: "Projected cash at the end of the window",
    },
    {
      label: "Net cash flow",
      value: `${data.net_cash_flow >= 0 ? "+" : ""}${formatCurrency(data.net_cash_flow, data.currency)}`,
      hint: "Total inflows minus total outflows",
    },
    {
      label: "Cash runway",
      value: runwayLabel,
      hint: data.runway_weeks === null ? "Stays cash-positive" : "Weeks until balance goes negative",
    },
    {
      label: "Total inflows",
      value: formatCurrency(data.total_inflows, data.currency),
      hint: "All scheduled money coming in",
    },
    {
      label: "Total outflows",
      value: formatCurrency(data.total_outflows, data.currency),
      hint: "All scheduled money going out (incl. GST)",
    },
    {
      label: "GST payments",
      value: formatCurrency(data.gst_total, data.currency),
      hint: "Total GST liability scheduled in the window",
    },
    {
      label: "Lowest balance",
      value: formatCurrency(data.trough_balance, data.currency),
      hint: data.trough_date
        ? `Tightest around ${monthLabel(data.trough_date)}`
        : "The minimum cash balance in the window",
    },
  ];

  return (
    <section className="bz-kpis" aria-label="Key figures">
      {kpis.map((k) => (
        <div key={k.label} className="bz-kpi">
          <div className="bz-kpi-label">{k.label}</div>
          <div className="bz-kpi-value num">{k.value}</div>
          <div className="bz-kpi-hint">{k.hint}</div>
        </div>
      ))}
    </section>
  );
}
