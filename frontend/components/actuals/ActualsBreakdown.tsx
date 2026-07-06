"use client";

import { formatCurrency } from "@/lib/format";

interface Props {
  inflows: Record<string, number>;
  outflows: Record<string, number>;
  currency: string;
}

function humanLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortedEntries(obj: Record<string, number>): [string, number][] {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

export function ActualsBreakdown({ inflows, outflows, currency }: Props) {
  const inflowRows = sortedEntries(inflows);
  const outflowRows = sortedEntries(outflows);
  const totalIn = inflowRows.reduce((a, [, v]) => a + v, 0);
  const totalOut = outflowRows.reduce((a, [, v]) => a + v, 0);

  return (
    <div className="act-breakdown">
      <div className="act-breakdown-col">
        <h3 className="act-breakdown-title pos">Money in</h3>
        <ul className="act-breakdown-list">
          {inflowRows.map(([k, v]) => (
            <li key={k} className="act-breakdown-row">
              <span className="act-breakdown-label">{humanLabel(k)}</span>
              <span className="act-breakdown-val num">{formatCurrency(v, currency)}</span>
              <span className="act-breakdown-pct num">
                {totalIn > 0 ? `${((v / totalIn) * 100).toFixed(0)}%` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="act-breakdown-col">
        <h3 className="act-breakdown-title neg">Money out</h3>
        <ul className="act-breakdown-list">
          {outflowRows.map(([k, v]) => (
            <li key={k} className="act-breakdown-row">
              <span className="act-breakdown-label">{humanLabel(k)}</span>
              <span className="act-breakdown-val num">{formatCurrency(v, currency)}</span>
              <span className="act-breakdown-pct num">
                {totalOut > 0 ? `${((v / totalOut) * 100).toFixed(0)}%` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
