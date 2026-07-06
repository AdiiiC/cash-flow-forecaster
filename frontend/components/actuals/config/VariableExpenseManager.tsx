"use client";

import { useEffect, useState } from "react";

import {
  VariableExpense,
  VariableExpenseInput,
  createVariableExpense,
  deleteVariableExpense,
  fetchVariableExpenses,
} from "@/lib/actualsApi";
import { formatCurrency } from "@/lib/format";

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY: VariableExpenseInput = {
  description: "",
  amount: 0,
  expected_date: todayIso(),
  category: "",
};

export function VariableExpenseManager() {
  const [items, setItems] = useState<VariableExpense[]>([]);
  const [form, setForm] = useState<VariableExpenseInput>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchVariableExpenses()
      .then(setItems)
      .catch((e) => setError(e.message ?? "Failed to load"));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createVariableExpense(form);
      setForm({ ...EMPTY, expected_date: todayIso() });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteVariableExpense(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="cfg-section">
      <div className="cfg-section-head">
        <h2>Variable / one-off expenses</h2>
        <p>Optional one-time outflows on a specific expected date.</p>
      </div>

      {error && <p className="cfg-error">{error}</p>}

      <form className="cfg-form" onSubmit={submit}>
        <div className="cfg-field cfg-field-wide">
          <label>Description</label>
          <input
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Conference sponsorship"
          />
        </div>
        <div className="cfg-field">
          <label>Amount</label>
          <input
            type="number"
            min={0}
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          />
        </div>
        <div className="cfg-field">
          <label>Expected date</label>
          <input
            type="date"
            value={form.expected_date}
            onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
          />
        </div>
        <div className="cfg-field">
          <label>Category</label>
          <input
            value={form.category ?? ""}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="marketing"
          />
        </div>
        <div className="cfg-field cfg-field-submit">
          <button type="submit" className="cfg-btn" disabled={busy}>
            {busy ? "Adding…" : "Add expense"}
          </button>
        </div>
      </form>

      <div className="cfg-list">
        {items.length === 0 && <p className="cfg-empty">No variable expenses yet.</p>}
        {items.map((v) => (
          <div key={v.id} className="cfg-row">
            <div className="cfg-row-main">
              <strong>{v.description}</strong>
              <span className="cfg-row-meta">
                {v.expected_date}
                {v.category ? ` · ${v.category}` : ""}
              </span>
            </div>
            <div className="cfg-row-val num">{formatCurrency(v.amount, "INR")}</div>
            <button className="cfg-del" onClick={() => remove(v.id)} title="Delete">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
