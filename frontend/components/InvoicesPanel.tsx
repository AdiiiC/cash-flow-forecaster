"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  ForecastResponse,
  Invoice,
  InvoiceKind,
  createInvoice,
  deleteInvoice,
  isAuthenticated,
  listInvoices,
  onAuthChange,
  setInvoiceStatus,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: ForecastResponse;
  /** Re-run the forecast so open AR/AP is reflected in runway/balance. */
  onChanged: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface DraftState {
  kind: InvoiceKind;
  counterparty: string;
  amount: string;
  issue_date: string;
  due_date: string;
  category: string;
}

function emptyDraft(): DraftState {
  return {
    kind: "receivable",
    counterparty: "",
    amount: "",
    issue_date: todayISO(),
    due_date: plusDaysISO(30),
    category: "",
  };
}

export function InvoicesPanel({ data, onChanged }: Props) {
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<Invoice[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    if (!isAuthenticated()) {
      setAuthed(false);
      setItems([]);
      return;
    }
    setAuthed(true);
    listInvoices()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refresh();
    return onAuthChange(refresh);
  }, [refresh]);

  const impact = data.receivables;
  const currency = data.currency;

  const canSave = useMemo(() => {
    const amt = Number(draft.amount);
    return (
      draft.counterparty.trim().length > 0 &&
      Number.isFinite(amt) &&
      amt > 0 &&
      !!draft.issue_date &&
      !!draft.due_date &&
      draft.due_date >= draft.issue_date
    );
  }, [draft]);

  const add = async () => {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const created = await createInvoice({
        kind: draft.kind,
        counterparty: draft.counterparty.trim(),
        amount: Number(draft.amount),
        issue_date: draft.issue_date,
        due_date: draft.due_date,
        category: draft.category.trim() || null,
      });
      setItems((prev) => [...prev, created]);
      setDraft(emptyDraft());
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save invoice.");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (inv: Invoice) => {
    try {
      const updated = await setInvoiceStatus(inv.id, "paid");
      setItems((prev) => prev.map((i) => (i.id === inv.id ? updated : i)));
      onChanged();
    } catch {
      /* non-fatal */
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteInvoice(id);
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
          <h2>Invoices &amp; bills</h2>
          <span className="badge" title="Money you're owed (AR) and money you owe (AP).">
            AR / AP
          </span>
        </div>
        <div className="saved-hint">
          Sign in to track invoices you&apos;re owed and bills you owe. Open items are
          folded into your runway on their due dates.
        </div>
      </div>
    );
  }

  const open = items.filter((i) => i.status === "open");
  const settled = items.filter((i) => i.status !== "open");

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Invoices &amp; bills</h2>
        <span className="badge" title="Open receivables and payables folded into your forecast.">
          {impact && impact.count > 0 ? `${impact.count} open` : "AR / AP"}
        </span>
      </div>

      {impact && impact.count > 0 && (
        <div className="recurring-impact">
          <div className="ri-cell pos">
            <span className="ri-label">Expected in (AR)</span>
            <span className="ri-value num">{formatCurrency(impact.expected_inflow, currency)}</span>
          </div>
          <div className="ri-cell neg">
            <span className="ri-label">Expected out (AP)</span>
            <span className="ri-value num">{formatCurrency(impact.expected_outflow, currency)}</span>
          </div>
          <div className="ri-cell">
            <span className="ri-label">
              Net{impact.overdue_count > 0 ? ` · ${impact.overdue_count} overdue` : ""}
            </span>
            <span className="ri-value num">{formatCurrency(impact.net_total, currency)}</span>
          </div>
        </div>
      )}

      <div className="invoice-form">
        <select
          className="rf-select"
          value={draft.kind}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as InvoiceKind })}
        >
          <option value="receivable">Owed to me</option>
          <option value="payable">I owe</option>
        </select>
        <input
          className="if-party"
          type="text"
          placeholder="Customer / vendor"
          value={draft.counterparty}
          maxLength={120}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })}
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
        <label className="if-date">
          <span>Issued</span>
          <input
            type="date"
            value={draft.issue_date}
            disabled={busy}
            onChange={(e) => setDraft({ ...draft, issue_date: e.target.value })}
          />
        </label>
        <label className="if-date">
          <span>Due</span>
          <input
            type="date"
            value={draft.due_date}
            disabled={busy}
            onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
          />
        </label>
        <button className="ghost rf-add" onClick={add} disabled={!canSave || busy}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <div className="saved-error">{error}</div>}

      {items.length === 0 ? (
        <div className="saved-empty">
          No invoices or bills yet. Add what you&apos;re owed or what you owe above.
        </div>
      ) : (
        <ul className="recurring-list">
          {[...open, ...settled].map((inv) => (
            <li
              key={inv.id}
              className={`invoice-item ${inv.kind} ${inv.status !== "open" ? "settled" : ""}`}
            >
              <span className="rl-dot" aria-hidden />
              <span className="rl-name">
                {inv.counterparty}
                {inv.category && <span className="rl-cat">{inv.category}</span>}
                {inv.overdue && <span className="rl-overdue">overdue</span>}
                {inv.status !== "open" && <span className="rl-paid">{inv.status}</span>}
              </span>
              <span className="rl-anchor num">due {inv.due_date}</span>
              <span className={`rl-amount num ${inv.kind === "payable" ? "outflow" : "inflow"}`}>
                {inv.kind === "payable" ? "−" : "+"}
                {formatCurrency(inv.amount, currency)}
              </span>
              {inv.status === "open" ? (
                <button
                  className="invoice-paid-btn"
                  onClick={() => markPaid(inv)}
                  title="Mark as paid"
                >
                  Mark paid
                </button>
              ) : (
                <span className="invoice-paid-spacer" aria-hidden />
              )}
              <button
                className="saved-del"
                onClick={() => remove(inv.id)}
                aria-label={`Delete ${inv.counterparty}`}
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
