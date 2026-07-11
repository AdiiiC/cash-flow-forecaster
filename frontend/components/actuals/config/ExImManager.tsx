"use client";

import { useEffect, useState } from "react";

import {
  ExImInvoice,
  ExImInvoiceInput,
  InvoiceStatus,
  createExIm,
  deleteExIm,
  fetchExIm,
  updateExImStatus,
} from "@/lib/exImApi";
import { formatCurrency } from "@/lib/format";

// ── Constants ──────────────────────────────────────────────────────────────

const FCY_CODES = ["USD", "EUR", "GBP", "JPY", "AED", "SGD", "AUD", "CAD", "CHF", "CNY", "HKD", "NZD"] as const;
const BASE_CURRENCIES = ["INR", "USD"] as const;

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY: ExImInvoiceInput = {
  kind: "receivable",
  counterparty: "",
  fcy_code: "USD",
  fcy_amount: 0,
  base_currency: "INR",
  payment_terms_days: 30,
  issue_date: TODAY,
  category: "",
  notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtRate(rate: number, fcy: string, base: string): string {
  return `${base} ${rate.toFixed(4)} / 1 ${fcy}`;
}

function fmtDeltaPct(spot: number, predicted: number): string {
  if (spot === 0) return "";
  const pct = ((predicted - spot) / spot) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function dueLabel(due: string, overdue: boolean): string {
  const d = new Date(due);
  const fmt = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return overdue ? `${fmt} — overdue` : fmt;
}

// ── Card component ─────────────────────────────────────────────────────────

function ExImCard({
  item,
  onStatusChange,
  onDelete,
}: {
  item: ExImInvoice;
  onStatusChange: (id: string, s: InvoiceStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isReceivable = item.kind === "receivable";
  const delta = fmtDeltaPct(item.spot_rate, item.predicted_rate_p50);
  const deltaPositive = item.predicted_rate_p50 >= item.spot_rate;

  return (
    <div className={`exim-card${item.overdue ? " exim-card-overdue" : ""}${item.status !== "open" ? " exim-card-closed" : ""}`}>
      <div className="exim-card-head">
        <div className="exim-card-meta">
          <span className={`exim-badge${isReceivable ? " exim-badge-export" : " exim-badge-import"}`}>
            {isReceivable ? "Export" : "Import"}
          </span>
          <span className="exim-counterparty">{item.counterparty}</span>
          {item.category && <span className="exim-category">{item.category}</span>}
        </div>
        <div className="exim-card-actions">
          {item.status === "open" && (
            <button
              className="cfg-btn exim-pay-btn"
              onClick={() => onStatusChange(item.id, "paid")}
            >
              Mark paid
            </button>
          )}
          {item.status !== "open" && (
            <span className={`exim-status-pill exim-status-${item.status}`}>
              {item.status}
            </span>
          )}
          <button className="cfg-del" onClick={() => onDelete(item.id)} aria-label="Delete">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
      </div>

      <div className="exim-amounts">
        <div className="exim-fcy num">
          {item.fcy_amount.toLocaleString()} {item.fcy_code}
        </div>
        <div className="exim-arrow">
          <svg viewBox="0 0 16 10" width="16" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 5h14M10 1l5 4-5 4" />
          </svg>
        </div>
        <div className="exim-base-amount">
          <span className="exim-p50 num">
            {formatCurrency(item.base_amount_p50, item.base_currency)}
          </span>
          <span className="exim-range num">
            {formatCurrency(item.base_amount_p10, item.base_currency, true)} – {formatCurrency(item.base_amount_p90, item.base_currency, true)}
          </span>
        </div>
      </div>

      <div className="exim-rate-widget">
        <div className="exim-rate-row">
          <span className="exim-rate-label">Booked rate</span>
          <span className="exim-rate-val num">{fmtRate(item.spot_rate, item.fcy_code, item.base_currency)}</span>
        </div>
        <div className="exim-rate-divider" />
        <div className="exim-rate-row">
          <span className="exim-rate-label">Predicted at due</span>
          <span className="exim-rate-val num">{fmtRate(item.predicted_rate_p50, item.fcy_code, item.base_currency)}</span>
          {delta && (
            <span className={`exim-delta num${deltaPositive ? " exim-delta-pos" : " exim-delta-neg"}`}>
              {delta}
            </span>
          )}
        </div>
      </div>

      <div className="exim-card-foot">
        <span className={`exim-due${item.overdue ? " exim-due-overdue" : ""}`}>
          Due {dueLabel(item.due_date, item.overdue)}
        </span>
        <span className="exim-model">{item.rate_model} · {item.predicted_at}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ExImManager() {
  const [items, setItems] = useState<ExImInvoice[]>([]);
  const [form, setForm] = useState<ExImInvoiceInput>(EMPTY);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchExIm()
      .then(setItems)
      .catch((e) => setError(e.message ?? "Failed to load ExIm invoices"));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await createExIm({
        ...form,
        fcy_amount: Number(form.fcy_amount),
        payment_terms_days: Number(form.payment_terms_days),
        category: form.category || null,
        notes: form.notes || null,
      });
      setForm({ ...EMPTY, issue_date: new Date().toISOString().slice(0, 10) });
      setSuccess("Invoice created. Predicted rate applied.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (id: string, s: InvoiceStatus) => {
    setError("");
    try {
      await updateExImStatus(id, s);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteExIm(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const openItems = items.filter((x) => x.status === "open");
  const closedItems = items.filter((x) => x.status !== "open");

  return (
    <div className="cfg-section">
      <div className="cfg-section-head">
        <h2>Export / Import invoices</h2>
        <p>
          Record cross-border trade receivables (exports) and payables (imports).
          The predicted rate at payment due date is calculated using the last 90 days
          of market data so you can see your expected cashflow in your base currency.
        </p>
      </div>

      {error && <p className="cfg-error">{error}</p>}
      {success && <p className="cfg-success">{success}</p>}

      <form className="cfg-form exim-form" onSubmit={submit}>
        <div className="cfg-field">
          <label>Trade direction</label>
          <div className="dip-seg" role="group">
            {(["receivable", "payable"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`dip-seg-btn${form.kind === k ? " active" : ""}`}
                onClick={() => setForm({ ...form, kind: k })}
                disabled={busy}
                aria-pressed={form.kind === k}
              >
                {k === "receivable" ? "Export (AR)" : "Import (AP)"}
              </button>
            ))}
          </div>
        </div>

        <div className="cfg-field">
          <label htmlFor="exim-cp">Counterparty</label>
          <input
            id="exim-cp"
            required
            placeholder="Acme Corp, USA"
            value={form.counterparty}
            onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
            disabled={busy}
          />
        </div>

        <div className="cfg-field">
          <label htmlFor="exim-base">Your base currency</label>
          <select
            id="exim-base"
            value={form.base_currency}
            onChange={(e) => setForm({ ...form, base_currency: e.target.value })}
            disabled={busy}
          >
            {BASE_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="cfg-field">
          <label htmlFor="exim-fcy">Foreign currency</label>
          <select
            id="exim-fcy"
            value={form.fcy_code}
            onChange={(e) => setForm({ ...form, fcy_code: e.target.value })}
            disabled={busy}
          >
            {FCY_CODES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="cfg-field">
          <label htmlFor="exim-amt">Amount ({form.fcy_code})</label>
          <input
            id="exim-amt"
            type="number"
            required
            min={0.01}
            step={0.01}
            value={form.fcy_amount || ""}
            onChange={(e) => setForm({ ...form, fcy_amount: Number(e.target.value) })}
            disabled={busy}
          />
        </div>

        <div className="cfg-field">
          <label htmlFor="exim-terms">Payment terms (days)</label>
          <input
            id="exim-terms"
            type="number"
            required
            min={1}
            max={3650}
            value={form.payment_terms_days}
            onChange={(e) => setForm({ ...form, payment_terms_days: Number(e.target.value) })}
            disabled={busy}
          />
        </div>

        <div className="cfg-field">
          <label htmlFor="exim-issue">Issue date</label>
          <input
            id="exim-issue"
            type="date"
            required
            value={form.issue_date}
            onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            disabled={busy}
          />
        </div>

        <div className="cfg-field">
          <label htmlFor="exim-cat">Category (optional)</label>
          <input
            id="exim-cat"
            placeholder="Software exports"
            value={form.category ?? ""}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            disabled={busy}
          />
        </div>

        <div className="cfg-field cfg-field-submit">
          <button type="submit" className="cfg-btn" disabled={busy || !form.counterparty || form.fcy_amount <= 0}>
            {busy ? "Predicting rate…" : "Add invoice"}
          </button>
        </div>
      </form>

      <div className="exim-list">
        {openItems.length === 0 && closedItems.length === 0 && (
          <p className="cfg-empty">
            No ExIm invoices yet. Add your first export or import above.
          </p>
        )}

        {openItems.length > 0 && (
          <div className="exim-group">
            <div className="exim-group-label">Open ({openItems.length})</div>
            {openItems.map((item) => (
              <ExImCard
                key={item.id}
                item={item}
                onStatusChange={handleStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {closedItems.length > 0 && (
          <div className="exim-group">
            <div className="exim-group-label">Settled ({closedItems.length})</div>
            {closedItems.map((item) => (
              <ExImCard
                key={item.id}
                item={item}
                onStatusChange={handleStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
