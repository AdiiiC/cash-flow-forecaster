"use client";

import { RunSummary } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface Props {
  runs: RunSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onClear: () => void;
  loading: boolean;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "http://localhost:8000";

export function RunHistory({ runs, activeId, onSelect, onRefresh, onClear, loading }: Props) {
  return (
    <aside className="history panel">
      <div className="panel-head">
        <h3>Run history</h3>
        <div className="history-actions">
          <button className="mini-btn" onClick={onRefresh} disabled={loading} aria-label="Refresh history">
            ↻
          </button>
          <button
            className="mini-btn"
            onClick={onClear}
            disabled={loading || runs.length === 0}
            title="Clear all saved runs"
            aria-label="Clear run history"
          >
            Clear
          </button>
        </div>
      </div>
      {runs.length === 0 && <div className="history-empty">No saved runs yet.</div>}
      <ul className="run-list">
        {runs.map((r) => {
          const when = new Date(r.created_at + "Z");
          const solvent = r.runway_weeks === null;
          return (
            <li key={r.id} className={`run-item ${r.id === activeId ? "active" : ""}`}>
              <button className="run-open" onClick={() => onSelect(r.id)}>
                <div className="run-top">
                  <span className="run-label">{r.label}</span>
                  <span className={`run-dot ${solvent ? "pos" : "neg"}`} aria-hidden />
                </div>
                <div className="run-meta num">
                  {formatCurrency(r.projected_balance_p50, r.currency, true)} ·{" "}
                  {solvent ? "solvent" : `${r.runway_weeks}w runway`}
                </div>
                <div className="run-when">
                  {when.toLocaleDateString()} {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </button>
              <a
                className="run-csv"
                href={`${API_BASE}/api/runs/${r.id}/export.csv`}
                title="Download CSV"
              >
                CSV
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
