"use client";

import { ForecastResponse } from "@/lib/api";

interface Props {
  data: ForecastResponse;
}

const KIND_ICON: Record<string, string> = {
  cut: "✂️",
  afford: "➕",
  info: "ℹ️",
};

/**
 * The headline answer a business owner actually cares about: how many months of
 * runway are left, the exact date cash is projected to run out, and the plain
 * next steps. Everything here is derived server-side (deterministic) so the copy
 * always matches the numbers on screen.
 */
export function RunwayHero({ data }: Props) {
  const insight = data.insight;
  if (!insight) return null;

  const solvent = insight.solvent;
  const months = insight.runway_months;
  const dangerDate = insight.runway_date
    ? new Date(insight.runway_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section className={`runway-hero ${solvent ? "ok" : "warn"}`} aria-label="Cash runway summary">
      <div className="runway-headline">
        <div className="runway-figure">
          <span className="runway-eyebrow">Cash runway</span>
          <span className="runway-number num">
            {solvent ? `${data.horizon_weeks}+ wk` : `${months} mo`}
          </span>
          <span className="runway-sub">
            {solvent
              ? "Stays cash-positive across the forecast"
              : dangerDate
                ? `Cash projected to run out around ${dangerDate}`
                : "Cash projected to run out within the forecast"}
          </span>
        </div>
        <div className={`runway-pill ${solvent ? "ok" : "warn"}`}>
          {solvent ? "On track" : "Action needed"}
        </div>
      </div>

      {insight.recommendations.length > 0 && (
        <ul className="runway-recs">
          {insight.recommendations.map((rec, i) => (
            <li key={i} className={`runway-rec ${rec.kind}`}>
              <span className="rec-icon" aria-hidden>
                {KIND_ICON[rec.kind] ?? "•"}
              </span>
              <span>{rec.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
