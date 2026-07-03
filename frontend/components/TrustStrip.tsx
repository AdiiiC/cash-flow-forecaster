"use client";

import { ForecastResponse } from "@/lib/api";
import { formatPercent } from "@/lib/format";

/**
 * Business-facing trust strip: translates the engineering rigour underneath
 * (walk-forward backtesting, conformal calibration, baseline benchmarking,
 * grounded generation) into plain-language reasons a non-technical stakeholder
 * can act on — while keeping the methods visible as the credibility signal.
 */
export function TrustStrip({ data }: { data: ForecastResponse }) {
  const coverage = data.calibration?.empirical ?? null;
  const origins = data.series[0]?.metrics.n_origins ?? null;
  const bestMase = Math.min(
    ...data.series
      .map((s) => s.metrics.mase)
      .filter((m) => Number.isFinite(m)),
  );
  const beatsBaseline = Number.isFinite(bestMase) && bestMase < 1;
  const grounded = data.narrative.grounded;

  const items: { title: string; body: string; method: string }[] = [
    {
      title: "Tested on your real history",
      body: origins
        ? `Re-checked ${origins} times against what actually happened next.`
        : "Re-checked against what actually happened next.",
      method: "walk-forward backtesting · no look-ahead",
    },
    {
      title: "Honest confidence ranges",
      body:
        coverage !== null
          ? `Reality landed inside the shaded range ${formatPercent(coverage)} of the time.`
          : "The shaded range is calibrated to hold most outcomes.",
      method: "split-conformal calibration",
    },
    {
      title: "Better than guessing",
      body: beatsBaseline
        ? "Beats a naive \u201Cnext week looks like last week\u201D forecast."
        : "Benchmarked against a naive baseline on every series.",
      method: "MASE vs seasonal-naive baseline",
    },
    {
      title: "Every number fact-checked",
      body: grounded
        ? "The written summary can't cite a figure the model didn't produce."
        : "Summary figures are verified against the model output.",
      method: "grounded generation",
    },
  ];

  return (
    <section className="trust" aria-label="Why you can trust these numbers">
      <div className="trust-head">Why you can trust these numbers</div>
      <div className="trust-grid">
        {items.map((it) => (
          <div className="trust-card" key={it.title}>
            <div className="trust-title">{it.title}</div>
            <div className="trust-body">{it.body}</div>
            <div className="trust-method" title={it.method}>
              {it.method}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
