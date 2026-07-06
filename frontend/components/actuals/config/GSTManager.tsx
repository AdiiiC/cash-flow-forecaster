"use client";

import { useEffect, useState } from "react";

import {
  GSTConfigInput,
  fetchGSTConfig,
  saveGSTConfig,
} from "@/lib/actualsApi";

const DEFAULT: GSTConfigInput = {
  frequency: "monthly",
  payment_day: 20,
  rate_pct: 18,
  active: true,
};

export function GSTManager() {
  const [form, setForm] = useState<GSTConfigInput>(DEFAULT);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchGSTConfig()
      .then((cfg) => {
        if (cfg) {
          setForm({
            frequency: cfg.frequency,
            payment_day: cfg.payment_day,
            rate_pct: cfg.rate_pct,
            active: cfg.active,
          });
        }
      })
      .catch((e) => setError(e.message ?? "Failed to load GST config"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await saveGSTConfig(form);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cfg-section">
      <div className="cfg-section-head">
        <h2>GST configuration</h2>
        <p>When GST payments hit your cash — reflected in the outflow schedule.</p>
      </div>

      {error && <p className="cfg-error">{error}</p>}
      {saved && <p className="cfg-success">GST configuration saved.</p>}

      <form className="cfg-form" onSubmit={submit}>
        <div className="cfg-field">
          <label>Filing frequency</label>
          <select
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as "monthly" | "quarterly" })}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
        <div className="cfg-field">
          <label>Payment day of month</label>
          <input
            type="number"
            min={1}
            max={28}
            value={form.payment_day}
            onChange={(e) => setForm({ ...form, payment_day: Number(e.target.value) })}
          />
        </div>
        <div className="cfg-field">
          <label>GST rate (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={form.rate_pct}
            onChange={(e) => setForm({ ...form, rate_pct: Number(e.target.value) })}
          />
        </div>
        <div className="cfg-field cfg-field-checkbox">
          <label>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Include GST in projections
          </label>
        </div>
        <div className="cfg-field cfg-field-submit">
          <button type="submit" className="cfg-btn" disabled={busy}>
            {busy ? "Saving…" : "Save GST config"}
          </button>
        </div>
      </form>
    </div>
  );
}
