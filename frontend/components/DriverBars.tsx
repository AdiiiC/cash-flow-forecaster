"use client";

import { Driver } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

/** Diverging bars: each category's exact signed weekly contribution to net cash
 *  flow. This is an arithmetic decomposition (net = sum of signed flows), not a
 *  fitted feature importance — every bar is a real ledger fact. */
export function DriverBars({ drivers, currency }: { drivers: Driver[]; currency: string }) {
  if (!drivers.length) return null;
  const max = Math.max(...drivers.map((d) => Math.abs(d.impact)), 1);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>What&apos;s moving your cash</h3>
        <span className="badge" title="Average money in (right) or out (left) per week, straight from the ledger — not a model guess.">
          avg per week
        </span>
      </div>
      <div className="drivers">
        {drivers.map((d) => {
          const w = (Math.abs(d.impact) / max) * 50; // half-width max (diverging)
          const positive = d.impact >= 0;
          return (
            <div key={`${d.category}-${d.direction}`} className="driver-row">
              <span className="driver-name">{d.category}</span>
              <div className="driver-track">
                <div className="driver-center" />
                <div
                  className={`driver-bar ${positive ? "pos" : "neg"}`}
                  style={{
                    width: `${w}%`,
                    left: positive ? "50%" : `${50 - w}%`,
                  }}
                />
              </div>
              <span className={`num driver-val ${positive ? "pos" : "neg"}`}>
                {positive ? "+" : ""}
                {formatCurrency(d.impact, currency, true)}/wk
              </span>
            </div>
          );
        })}
      </div>
      <div className="driver-note">
        Each bar is a real category from your ledger: green adds cash, red spends
        it. Longer bars move your balance the most week to week.
      </div>
    </div>
  );
}
