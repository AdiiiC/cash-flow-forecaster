"use client";

import { useRef, useState } from "react";

import { DemoParams } from "@/lib/api";
import { NumberField } from "@/components/NumberField";

interface Props {
  params: DemoParams;
  onParamsChange: (p: DemoParams) => void;
  onRunDemo: () => void;
  onUpload: (file: File, openingBalance: number) => void;
  loading: boolean;
}

// Currency-appropriate demo defaults and stepper increments, so switching to
// INR produces a realistic SaaS scenario rather than tiny figures.
const CURRENCY_PRESETS: Record<
  string,
  { starting_mrr: number; opening_balance: number; mrrStep: number; balStep: number }
> = {
  USD: { starting_mrr: 80_000, opening_balance: 250_000, mrrStep: 5_000, balStep: 10_000 },
  INR: { starting_mrr: 6_600_000, opening_balance: 20_000_000, mrrStep: 500_000, balStep: 1_000_000 },
};

const CURRENCIES = ["USD", "INR"] as const;

export function Controls({ params, onParamsChange, onRunDemo, onUpload, loading }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const set = (key: keyof DemoParams) => (v: number) => {
    onParamsChange({ ...params, [key]: v });
  };

  const preset = CURRENCY_PRESETS[params.currency] ?? CURRENCY_PRESETS.USD;

  const setThreshold = (key: "min_balance" | "min_runway_weeks") => (v: number) => {
    // 0 (or below) disables that threshold.
    const next = v > 0 ? v : null;
    onParamsChange({ ...params, thresholds: { ...params.thresholds, [key]: next } });
  };

  const setCurrency = (currency: string) => {
    // Switching currency reloads that currency's default scenario amounts.
    const p = CURRENCY_PRESETS[currency] ?? CURRENCY_PRESETS.USD;
    onParamsChange({
      ...params,
      currency,
      starting_mrr: p.starting_mrr,
      opening_balance: p.opening_balance,
    });
  };

  return (
    <div className="controls">
      <div className="field">
        <label>Currency</label>
        <div className="segmented" role="group" aria-label="Currency">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`seg ${params.currency === c ? "active" : ""}`}
              aria-pressed={params.currency === c}
              onClick={() => setCurrency(c)}
              disabled={loading}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <NumberField
        id="weeks"
        label="History used (weeks)"
        value={params.weeks}
        onChange={set("weeks")}
        min={26}
        max={520}
        step={4}
        disabled={loading}
        hint="How much past data the model learns from. More history can capture longer trends."
      />
      <NumberField
        id="mrr"
        label="Monthly revenue (MRR)"
        value={params.starting_mrr}
        onChange={set("starting_mrr")}
        min={0}
        step={preset.mrrStep}
        disabled={loading}
        hint="Monthly Recurring Revenue — your predictable subscription income at the start."
      />
      <NumberField
        id="open"
        label="Cash on hand"
        value={params.opening_balance}
        onChange={set("opening_balance")}
        step={preset.balStep}
        disabled={loading}
        hint="Cash available in the bank at the start of the forecast."
      />
      <NumberField
        id="seed"
        label="Demo seed"
        value={params.seed}
        onChange={set("seed")}
        min={0}
        step={1}
        disabled={loading}
        hint="Only affects the sample demo data. Same seed = same numbers, so results are reproducible."
      />

      <NumberField
        id="minbal"
        label="Warn if cash below"
        value={params.thresholds?.min_balance ?? 0}
        onChange={setThreshold("min_balance")}
        min={0}
        step={preset.balStep}
        disabled={loading}
        hint="Show an alert if projected cash ever drops under this amount. 0 turns it off."
      />
      <NumberField
        id="minrunway"
        label="Warn if runway under (weeks)"
        value={params.thresholds?.min_runway_weeks ?? 0}
        onChange={setThreshold("min_runway_weeks")}
        min={0}
        max={104}
        step={1}
        disabled={loading}
        hint="Alert if cash is projected to run out within this many weeks. 0 turns it off."
      />

      <button className="primary" onClick={onRunDemo} disabled={loading}>
        {loading ? "Forecasting…" : "Run forecast"}
      </button>

      <div className="field">
        <label>Or upload your own data (CSV)</label>
        <button className="file-btn" disabled={loading}>
          {fileName ?? "Upload CSV"}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFileName(f.name);
                onUpload(f, params.opening_balance);
              }
            }}
          />
        </button>
      </div>
    </div>
  );
}
