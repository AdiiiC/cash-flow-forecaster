"use client";

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SeriesForecast } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent, formatWeekLabel } from "@/lib/format";

interface Row {
  period: string;
  actual?: number;
  p50?: number;
  band?: [number, number];
}

function buildRows(series: SeriesForecast): Row[] {
  // Show the tail of history for context, then the forecast with its band.
  const tail = series.history.slice(-16).map((h) => ({ period: h.period, actual: h.value }));
  const fc = series.forecast.map((p) => ({
    period: p.period,
    p50: p.p50,
    band: [p.p10, p.p90] as [number, number],
  }));
  // Bridge the last actual into the forecast line so it connects visually.
  const last = series.history[series.history.length - 1];
  if (last && fc.length) {
    (fc[0] as Row).p50 = fc[0].p50;
  }
  return [...tail, ...fc];
}

function SeriesTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div
      style={{
        background: "var(--ink-700)",
        border: "1px solid var(--line-strong)",
        borderRadius: 4,
        padding: "8px 10px",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--text-faint)" }}>{row.period}</div>
      {row.actual !== undefined && (
        <div className="num">actual {formatCurrency(row.actual, currency)}</div>
      )}
      {row.p50 !== undefined && (
        <div className="num">P50 {formatCurrency(row.p50, currency)}</div>
      )}
      {row.band && (
        <div className="num" style={{ color: "var(--text-muted)" }}>
          P10–P90 {formatCurrency(row.band[0], currency)} … {formatCurrency(row.band[1], currency)}
        </div>
      )}
    </div>
  );
}

export function SeriesPanel({ series }: { series: SeriesForecast }) {
  const rows = buildRows(series);
  const currency = series.unit.split("/")[0];
  const models = Object.entries(series.candidates).sort((a, b) => a[1] - b[1]);
  const worst = Math.max(...models.map(([, v]) => (Number.isFinite(v) ? v : 0)), 1);

  const beatsBaseline = Number.isFinite(series.metrics.mase) && series.metrics.mase < 1;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{series.label}</h3>
        <span className={`badge ${beatsBaseline ? "ok" : "warn"}`}>
          {series.model} · MASE {formatNumber(series.metrics.mase)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={rows} margin={{ top: 6, right: 10, bottom: 0, left: 6 }}>
          <XAxis
            dataKey="period"
            tickFormatter={formatWeekLabel}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={30}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency, true)}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip content={<SeriesTooltip currency={currency} />} />
          <Area
            dataKey="band"
            stroke="none"
            fill="var(--band)"
            isAnimationActive={false}
            activeDot={false}
            connectNulls
          />
          <Line
            dataKey="actual"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            dataKey="p50"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="metric-row">
        <div className="metric" title="Accuracy vs a naive baseline. Below 1.0 means it beats 'next week = last week'. Lower is better.">
          <span className="m-label">Accuracy (MASE)</span>
          <span className={`m-value num ${beatsBaseline ? "pos" : "neg"}`}>
            {formatNumber(series.metrics.mase)}
          </span>
        </div>
        <div className="metric" title="How often reality landed inside the shaded range during testing. Close to 80% is well-calibrated.">
          <span className="m-label">Range accuracy</span>
          <span className="m-value num">{formatPercent(series.metrics.coverage_80)}</span>
        </div>
        <div className="metric" title="Pinball loss: a scoring rule for the full range of outcomes. Lower is better.">
          <span className="m-label">Range score</span>
          <span className="m-value num">{formatCurrency(series.metrics.pinball, currency, true)}</span>
        </div>
        <div className="metric" title="How many times the model was re-tested on past data before you saw this.">
          <span className="m-label">Times tested</span>
          <span className="m-value num">{series.metrics.n_origins}</span>
        </div>
      </div>

      <div className="leaderboard" aria-label="Model comparison" title="Models we tried — the winner (lowest error) was chosen automatically.">
        {models.map(([name, mase]) => (
          <div key={name} className={`lb-row ${name === series.model ? "winner" : ""}`}>
            <span className="lb-name">{name}</span>
            <span
              className="bar"
              style={{ width: `${Math.max(4, (1 - Math.min(mase, worst) / worst) * 100)}%` }}
            />
            <span className="num" style={{ textAlign: "right", color: "var(--text-muted)" }}>
              {formatNumber(mase)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
