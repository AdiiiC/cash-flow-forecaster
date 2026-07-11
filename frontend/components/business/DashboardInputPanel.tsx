"use client";

import { useState } from "react";

import type { DemoParams } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface Props {
  params: DemoParams;
  onRun: (p: DemoParams) => void;
  loading: boolean;
}

const CURRENCIES = ["INR", "USD"] as const;

const CURRENCY_PRESETS: Record<
  string,
  { starting_mrr: number; opening_balance: number }
> = {
  USD: { starting_mrr: 80_000, opening_balance: 250_000 },
  INR: { starting_mrr: 6_600_000, opening_balance: 20_000_000 },
};

const HORIZON_OPTIONS: { label: string; value: number }[] = [
  { label: "13w", value: 13 },
  { label: "26w", value: 26 },
  { label: "52w", value: 52 },
  { label: "104w", value: 104 },
];

function summarise(p: DemoParams): string {
  const bal = formatCurrency(p.opening_balance, p.currency, true);
  const mrr = formatCurrency(p.starting_mrr, p.currency, true);
  return `${p.currency} · ${bal} opening · ${mrr} MRR · ${p.weeks}w`;
}

export function DashboardInputPanel({ params, onRun, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DemoParams>(params);

  const setCurrency = (currency: string) => {
    const p = CURRENCY_PRESETS[currency] ?? CURRENCY_PRESETS.INR;
    setDraft((d) => ({ ...d, currency, ...p }));
  };

  const setField =
    (key: "opening_balance" | "starting_mrr") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v) && v >= 0) setDraft((d) => ({ ...d, [key]: v }));
    };

  const setWeeks = (value: number) => setDraft((d) => ({ ...d, weeks: value }));

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
        <span className="dip-panel-title">Configure your numbers</span>
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
          <label className="dip-label" htmlFor="dip-balance">
            Cash on hand
          </label>
          <input
            id="dip-balance"
            type="number"
            className="dip-input num"
            value={draft.opening_balance}
            min={0}
            step={draft.currency === "USD" ? 10_000 : 1_000_000}
            onChange={setField("opening_balance")}
            disabled={loading}
          />
        </div>

        <div className="dip-field">
          <label className="dip-label" htmlFor="dip-mrr">
            Monthly revenue (MRR)
          </label>
          <input
            id="dip-mrr"
            type="number"
            className="dip-input num"
            value={draft.starting_mrr}
            min={0}
            step={draft.currency === "USD" ? 5_000 : 500_000}
            onChange={setField("starting_mrr")}
            disabled={loading}
          />
        </div>

        <div className="dip-field">
          <label className="dip-label">Forecast horizon</label>
          <div className="dip-seg" role="group" aria-label="Horizon">
            {HORIZON_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`dip-seg-btn${draft.weeks === value ? " active" : ""}`}
                onClick={() => setWeeks(value)}
                disabled={loading}
                aria-pressed={draft.weeks === value}
              >
                {label}
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
          {loading ? "Running…" : "Run forecast"}
        </button>
        <span className="dip-note">
          Uses demo-generated data shaped by your inputs.
        </span>
      </div>
    </div>
  );
}
