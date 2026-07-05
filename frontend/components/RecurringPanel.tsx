"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  Cadence,
  Direction,
  ForecastResponse,
  RecurringItem,
  createRecurring,
  deleteRecurring,
  isAuthenticated,
  listRecurring,
  onAuthChange,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: ForecastResponse;
  /** Re-run the forecast so the new schedule is reflected in runway/balance. */
  onChanged: () => void;
}

const CADENCES: { value: Cadence; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DraftState {
  name: string;
  amount: string;
  direction: Direction;
  cadence: Cadence;
  anchor_date: string;
  category: string;
}

const EMPTY_DRAFT: DraftState = {
  name: "",
  amount: "",
  direction: "outflow",
  cadence: "monthly",
  anchor_date: todayISO(),
  category: "",
};

export function RecurringPanel({ data, onChanged }: Props) {
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    if (!isAuthenticated()) {
      setAuthed(false);
      setItems([]);
      return;
    }
    setAuthed(true);
    listRecurring()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refresh();
    return onAuthChange(refresh);
  }, [refresh]);

  const impact = data.recurring;
  const currency = data.currency;

  const canSave = useMemo(() => {
    const amt = Number(draft.amount);
    return draft.name.trim().length > 0 && Number.isFinite(amt) && amt > 0 && !!draft.anchor_date;
  }, [draft]);

  const add = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const created = await createRecurring({
        name: draft.name.trim(),
        amount: Number(draft.amount),
        direction: draft.direction,
        cadence: draft.cadence,
        anchor_date: draft.anchor_date,
        category: draft.category.trim() || null,
      });
      setItems((prev) => [...prev, created]);
      setDraft({ ...EMPTY_DRAFT, anchor_date: draft.anchor_date });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save item.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteRecurring(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      onChanged();
    } catch {
      /* non-fatal */
    }
  };

  if (!authed) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Scheduled cash</h2>
          <span className="badge" title="Payroll, rent, subscriptions and other known repeating cash events.">
            recurring items
          </span>
        </div>
        <div className="saved-hint">
          Sign in to add known repeating cash events (payroll, rent, subscriptions).
          They&apos;re folded into your runway automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Scheduled cash</h2>
        <span className="badge" title="Known repeating cash events folded into your forecast.">
          {impact && impact.count > 0 ? `${impact.count} active` : "recurring items"}
        </span>
      </div>

      {impact && impact.count > 0 && (
        <div className="recurring-impact">
          <div className="ri-cell pos">
            <span className="ri-label">Scheduled in</span>
            <span className="ri-value num">{formatCurrency(impact.inflow_total, currency)}</span>
          </div>
          <div className="ri-cell neg">
            <span className="ri-label">Scheduled out</span>
            <span className="ri-value num">{formatCurrency(impact.outflow_total, currency)}</span>
          </div>
          <div className="ri-cell">
            <span className="ri-label">Net over horizon</span>
            <span className="ri-value num">{formatCurrency(impact.net_total, currency)}</span>
          </div>
        </div>
      )}

      <div className="recurring-form">
        <input
          className="rf-name"
          type="text"
          placeholder="Name (e.g. Payroll)"
          value={draft.name}
          maxLength={120}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <input
          className="rf-amount num"
          type="number"
          min={0}
          step="0.01"
          placeholder="Amount"
          value={draft.amount}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
        />
        <select
          className="rf-select"
          value={draft.direction}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, direction: e.target.value as Direction })}
        >
          <option value="outflow">Out</option>
          <option value="inflow">In</option>
        </select>
        <select
          className="rf-select"
          value={draft.cadence}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, cadence: e.target.value as Cadence })}
        >
          {CADENCES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          className="rf-date"
          type="date"
          value={draft.anchor_date}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, anchor_date: e.target.value })}
          title="Next occurrence date"
        />
        <input
          className="rf-cat"
          type="text"
          placeholder="Category (optional)"
          value={draft.category}
          maxLength={60}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        />
        <button className="ghost rf-add" onClick={add} disabled={!canSave || busy}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <div className="saved-error">{error}</div>}

      {items.length === 0 ? (
        <div className="saved-empty">No scheduled items yet. Add payroll, rent, or subscriptions above.</div>
      ) : (
        <ul className="recurring-list">
          {items.map((it) => (
            <li key={it.id} className={`recurring-item ${it.direction}`}>
              <span className="rl-dot" aria-hidden />
              <span className="rl-name">
                {it.name}
                {it.category && <span className="rl-cat">{it.category}</span>}
              </span>
              <span className="rl-cadence">{it.cadence}</span>
              <span className="rl-anchor num">{it.anchor_date}</span>
              <span className={`rl-amount num ${it.direction}`}>
                {it.direction === "outflow" ? "−" : "+"}
                {formatCurrency(it.amount, currency)}
              </span>
              <button
                className="saved-del"
                onClick={() => remove(it.id)}
                aria-label={`Delete ${it.name}`}
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
