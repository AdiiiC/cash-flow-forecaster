"use client";

import { useEffect, useState } from "react";

import {
  FixedExpense,
  FixedExpenseInput,
  createFixedExpense,
  deleteFixedExpense,
  fetchFixedExpenses,
} from "@/lib/actualsApi";
import { formatCurrency } from "@/lib/format";

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY: FixedExpenseInput = {
  name: "",
  amount: 0,
  frequency: "monthly",
  last_payment_date: todayIso(),
  category: "",
  active: true,
};

export function FixedExpenseManager() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [form, setForm] = useState<FixedExpenseInput>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchFixedExpenses()
      .then(setItems)
      .catch((e) => setError(e.message ?? "Failed to load"));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createFixedExpense(form);
      setForm({ ...EMPTY, last_payment_date: todayIso() });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteFixedExpense(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="cfg-section">
      <div className="cfg-section-head">
        <h2>Fixed / recurring expenses</h2>
        <p>Salaries, rent, subscriptions — auto-scheduled from frequency + last payment.</p>
      </div>

      {error && <p className="cfg-error">{error}</p>}

      <form className="cfg-form" onSubmit={submit}>
        <div className="cfg-field">
          <label>Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Salaries"
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
          <label>Frequency</label>
          <select
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value as FixedExpenseInput["frequency"] })}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div className="cfg-field">
          <label>Last payment date</label>
          <input
            type="date"
            value={form.last_payment_date}
            onChange={(e) => setForm({ ...form, last_payment_date: e.target.value })}
          />
        </div>
        <div className="cfg-field">
          <label>Category</label>
          <input
            value={form.category ?? ""}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="payroll"
          />
        </div>
        <div className="cfg-field cfg-field-submit">
          <button type="submit" className="cfg-btn" disabled={busy}>
            {busy ? "Adding…" : "Add expense"}
          </button>
        </div>
      </form>

      <div className="cfg-list">
        {items.length === 0 && <p className="cfg-empty">No fixed expenses yet.</p>}
        {items.map((f) => (
          <div key={f.id} className="cfg-row">
            <div className="cfg-row-main">
              <strong>{f.name}</strong>
              <span className="cfg-row-meta">
                {f.frequency} · last {f.last_payment_date}
                {f.category ? ` · ${f.category}` : ""}
              </span>
            </div>
            <div className="cfg-row-val num">{formatCurrency(f.amount, "INR")}</div>
            <button className="cfg-del" onClick={() => remove(f.id)} title="Delete">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
