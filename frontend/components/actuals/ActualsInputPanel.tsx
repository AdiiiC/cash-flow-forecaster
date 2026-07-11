"use client";

import { useState } from "react";

import { formatCurrency } from "@/lib/format";

export interface ActualsParams {
  opening_balance: number;
  currency: string;
  horizon_weeks: number;
  granularity: "daily" | "weekly";
}

interface Props {
  params: ActualsParams;
  onRun: (p: ActualsParams) => void;
  loading: boolean;
}

const CURRENCIES = ["INR", "USD"] as const;

const BALANCE_PRESETS: Record<string, number> = {
  USD: 250_000,
  INR: 20_000_000,
};

const HORIZON_OPTIONS: { label: string; value: number }[] = [
  { label: "13w", value: 13 },
  { label: "26w", value: 26 },
  { label: "52w", value: 52 },
];

function summarise(p: ActualsParams): string {
  const bal = formatCurrency(p.opening_balance, p.currency, true);
  return `${p.currency} · ${bal} opening · ${p.horizon_weeks}w · ${p.granularity}`;
}

export function ActualsInputPanel({ params, onRun, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ActualsParams>(params);

  const setCurrency = (currency: string) => {
    const opening_balance = BALANCE_PRESETS[currency] ?? BALANCE_PRESETS.INR;
    setDraft((d) => ({ ...d, currency, opening_balance }));
  };

  const setBalance = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= 0) setDraft((d) => ({ ...d, opening_balance: v }));
  };

  const setHorizon = (horizon_weeks: number) =>
    setDraft((d) => ({ ...d, horizon_weeks }));

  const setGranularity = (granularity: "daily" | "weekly") =>
    setDraft((d) => ({ ...d, granularity }));

  const handleRun = () => {
    onRun(draft);
    setOpen(false);
  };

  const handleOpen = () => {
    setDraft(params);
    setOpen(true);
  };

  if (!open) {
    return (
      <div className="dip-bar">
        <span className="dip-summary">{summarise(params)}</span>
        <button
          type="button"
          className="dip-edit-btn"
          onClick={handleOpen}
          disabled={loading}
        >
          Edit inputs
        </button>
      </div>
    );
  }

  return (
    <div className="dip-panel">
      <div className="dip-panel-head">
        <span className="dip-panel-title">Configure projection inputs</span>
        <button
          type="button"
          className="dip-close"
          onClick={() => setOpen(false)}
          aria-label="Close input panel"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div className="dip-fields">
        <div className="dip-field">
          <label className="dip-label">Currency</label>
          <div className="dip-seg" role="group" aria-label="Currency">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`dip-seg-btn${draft.currency === c ? " active" : ""}`}
                onClick={() => setCurrency(c)}
                disabled={loading}
                aria-pressed={draft.currency === c}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="dip-field">
          <label className="dip-label" htmlFor="aip-balance">
            Opening cash on hand
          </label>
          <input
            id="aip-balance"
            type="number"
            className="dip-input num"
            value={draft.opening_balance}
            min={0}
            step={draft.currency === "USD" ? 10_000 : 1_000_000}
            onChange={setBalance}
            disabled={loading}
          />
        </div>

        <div className="dip-field">
          <label className="dip-label">Horizon</label>
          <div className="dip-seg" role="group" aria-label="Horizon">
            {HORIZON_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`dip-seg-btn${draft.horizon_weeks === value ? " active" : ""}`}
                onClick={() => setHorizon(value)}
                disabled={loading}
                aria-pressed={draft.horizon_weeks === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="dip-field">
          <label className="dip-label">Granularity</label>
          <div className="dip-seg" role="group" aria-label="Granularity">
            {(["daily", "weekly"] as const).map((g) => (
              <button
                key={g}
                type="button"
                className={`dip-seg-btn${draft.granularity === g ? " active" : ""}`}
                onClick={() => setGranularity(g)}
                disabled={loading}
                aria-pressed={draft.granularity === g}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dip-actions">
        <button
          type="button"
          className="dip-run-btn"
          onClick={handleRun}
          disabled={loading}
        >
          {loading ? "Running…" : "Run projection"}
        </button>
        <span className="dip-note">
          Uses your saved entries from the setup screens.
        </span>
      </div>
    </div>
  );
}
