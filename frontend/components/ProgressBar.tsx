"use client";

import { ProgressEvent } from "@/lib/api";

export function ProgressBar({ progress }: { progress: ProgressEvent | null }) {
  const pct = Math.round((progress?.fraction ?? 0.05) * 100);
  return (
    <div className="progress-wrap" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-head">
        <span>{progress?.message ?? "Starting…"}</span>
        <span className="num">{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-note">
        Running an expanding-window backtest across all series — no leakage, so
        this takes a moment.
      </div>
    </div>
  );
}
