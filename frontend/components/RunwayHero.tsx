"use client";

import { ForecastResponse } from "@/lib/api";

interface Props {
  data: ForecastResponse;
}

/** Minimal 16px line icons; stroke uses currentColor so per-kind CSS colors apply. */
const KIND_ICON: Record<string, JSX.Element> = {
  cut: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  afford: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const FALLBACK_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
    <circle cx="12" cy="12" r="4" />
  </svg>
);

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
                {KIND_ICON[rec.kind] ?? FALLBACK_ICON}
              </span>
              <span>{rec.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
