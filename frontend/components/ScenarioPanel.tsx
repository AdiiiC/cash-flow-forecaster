"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ApiError,
  ForecastResponse,
  SavedScenario,
  ScenarioInput,
  SeriesForecast,
  deleteScenario,
  isAuthenticated,
  listScenarios,
  onAuthChange,
  saveScenario,
} from "@/lib/api";
import { NumberField } from "@/components/NumberField";
import { formatCurrency, formatWeekLabel } from "@/lib/format";

interface Props {
  input: ScenarioInput;
  onChange: (s: ScenarioInput) => void;
  onApply: () => void;
  onClear: () => void;
  data: ForecastResponse;
  loading: boolean;
}

function balancePath(opening: number, net: SeriesForecast, asOf: string): { period: string; v: number }[] {
  let cum = opening;
  const rows = [{ period: asOf, v: cum }];
  for (const p of net.forecast) {
    cum += p.p50;
    rows.push({ period: p.period, v: cum });
  }
  return rows;
}

/**
 * A saved-scenarios drawer: name and store the current what-if as a reusable
 * preset (per user), then reload or delete presets. Only meaningful when signed
 * in; anonymous visitors get a gentle prompt instead.
 */
function SavedScenarios({
  input,
  onLoad,
  disabled,
}: {
  input: ScenarioInput;
  onLoad: (s: ScenarioInput) => void;
  disabled: boolean;
}) {
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<SavedScenario[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    if (!isAuthenticated()) {
      setAuthed(false);
      setItems([]);
      return;
    }
    setAuthed(true);
    listScenarios()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refresh();
    return onAuthChange(refresh);
  }, [refresh]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      const saved = await saveScenario(trimmed, input);
      setItems((prev) => [saved, ...prev]);
      setName("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save scenario.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteScenario(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch {
      /* non-fatal */
    }
  };

  if (!authed) {
    return (
      <div className="saved-scenarios">
        <div className="saved-hint">Sign in to save what-if scenarios and reuse them later.</div>
      </div>
    );
  }

  return (
    <div className="saved-scenarios">
      <div className="saved-head">Saved scenarios</div>
      <div className="saved-save">
        <input
          type="text"
          placeholder="Name this scenario…"
          value={name}
          maxLength={120}
          disabled={disabled || busy}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button className="ghost" onClick={save} disabled={disabled || busy || !name.trim()}>
          {busy ? "Saving…" : "Save current"}
        </button>
      </div>
      {error && <div className="saved-error">{error}</div>}
      {items.length === 0 ? (
        <div className="saved-empty">No saved scenarios yet.</div>
      ) : (
        <ul className="saved-list">
          {items.map((s) => (
            <li key={s.id} className="saved-item">
              <button
                className="saved-load"
                onClick={() => onLoad(s.scenario)}
                disabled={disabled}
                title="Load this scenario"
              >
                {s.name}
              </button>
              <button
                className="saved-del"
                onClick={() => remove(s.id)}
                aria-label={`Delete ${s.name}`}
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScenarioPanel({ input, onChange, onApply, onClear, data, loading }: Props) {
  const result = data.scenario;
  const set = (key: keyof ScenarioInput) => (v: number) => onChange({ ...input, [key]: v });
  const baseNet = data.series.find((s) => s.name === "net_cash_flow");
  const scenNet = result?.series.find((s) => s.name === "net_cash_flow");

  let rows: { period: string; base: number; scenario?: number }[] = [];
  if (baseNet) {
    const b = balancePath(data.opening_balance, baseNet, data.as_of);
    const s = scenNet ? balancePath(data.opening_balance, scenNet, data.as_of) : null;
    rows = b.map((r, i) => ({ period: r.period, base: r.v, scenario: s ? s[i]?.v : undefined }));
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>What-if planner</h2>
        <span className="badge" title="An instant estimate: we transform the forecast to reflect your assumptions.">
          instant estimate
        </span>
      </div>

      <div className="scenario-grid">
        <NumberField
          id="growth"
          label="Revenue growth (% / week)"
          value={input.revenue_growth_pct}
          onChange={set("revenue_growth_pct")}
          min={-20}
          max={20}
          step={0.5}
          disabled={loading}
          hint="How fast money coming in grows each week, compounded."
        />
        <NumberField
          id="cost"
          label="Costs vs today (×)"
          value={input.cost_multiplier}
          onChange={set("cost_multiplier")}
          min={0.1}
          max={3}
          step={0.05}
          disabled={loading}
          hint="Scale your outgoings. 0.9 = cut costs 10%, 1.2 = spend 20% more."
        />
        <NumberField
          id="oneoff"
          label="One-off cash event"
          value={input.one_off_amount}
          onChange={set("one_off_amount")}
          min={0}
          step={10000}
          disabled={loading}
          hint="A single lump sum — e.g. a big invoice paid, or a large purchase."
        />
        <NumberField
          id="oneoffweek"
          label="...happening in week"
          value={input.one_off_week}
          onChange={set("one_off_week")}
          min={1}
          max={data.horizon_weeks}
          step={1}
          disabled={loading}
          hint="Which week the one-off cash event lands in."
        />
        <div className="field">
          <label>Money in or out?</label>
          <div className="segmented" role="group" aria-label="One-off direction">
            {(["inflow", "outflow"] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={`seg ${input.one_off_direction === d ? "active" : ""}`}
                aria-pressed={input.one_off_direction === d}
                onClick={() => onChange({ ...input, one_off_direction: d })}
                disabled={loading}
              >
                {d === "inflow" ? "Money in" : "Money out"}
              </button>
            ))}
          </div>
        </div>
        <div className="scenario-actions">
          <button className="primary" onClick={onApply} disabled={loading}>
            {loading ? "Applying…" : "See what-if"}
          </button>
          {result && (
            <button className="ghost" onClick={onClear} disabled={loading}>
              Reset
            </button>
          )}
        </div>
      </div>

      <SavedScenarios input={input} onLoad={onChange} disabled={loading} />

      {result && (
        <>
          <div className="scenario-deltas">
            <Delta
              label="Projected balance"
              value={result.projected_balance_p50}
              delta={result.delta_projected_balance}
              currency={data.currency}
            />
            <Delta
              label="Net cash (13 weeks)"
              value={undefined}
              delta={result.delta_net_total}
              currency={data.currency}
            />
            <div className="metric">
              <span className="m-label">What-if runway</span>
              <span className={`m-value num ${result.runway_weeks === null ? "pos" : "neg"}`}>
                {result.runway_weeks === null ? "13+ weeks" : `${result.runway_weeks} weeks`}
              </span>
            </div>
          </div>

          <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <XAxis
                dataKey="period"
                tickFormatter={formatWeekLabel}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v, data.currency, true)}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <div
                      style={{
                        background: "var(--ink-700)",
                        border: "1px solid var(--line-strong)",
                        borderRadius: 4,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ color: "var(--text-faint)" }}>{label}</div>
                      {payload.map((p: any) => (
                        <div key={p.dataKey} className="num" style={{ color: p.stroke }}>
                          {p.dataKey} {formatCurrency(p.value, data.currency)}
                        </div>
                      ))}
                    </div>
                  ) : null
                }
              />
              <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="4 4" />
              <Line
                dataKey="base"
                name="baseline"
                stroke="var(--text-muted)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="scenario"
                name="scenario"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
          <div className="driver-note">
            This what-if is a transparent estimate built from the main forecast
            (growth compounded weekly, costs scaled, one-off applied). It is a
            quick planning view, so it doesn&apos;t carry the full confidence band
            — use it to compare directions, not as a re-tested forecast.
          </div>
        </>
      )}
    </div>
  );
}

function Delta({
  label,
  value,
  delta,
  currency,
}: {
  label: string;
  value?: number;
  delta: number;
  currency: string;
}) {
  const up = delta >= 0;
  return (
    <div className="metric">
      <span className="m-label">{label}</span>
      {value !== undefined && <span className="m-value num">{formatCurrency(value, currency)}</span>}
      <span className={`num ${up ? "pos" : "neg"}`} style={{ fontSize: 12 }}>
        {up ? "+" : ""}
        {formatCurrency(delta, currency)}
      </span>
    </div>
  );
}
