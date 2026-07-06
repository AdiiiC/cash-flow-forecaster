"use client";

import { useEffect, useState } from "react";

import {
  Customer,
  CustomerInput,
  createCustomer,
  deleteCustomer,
  fetchCustomers,
} from "@/lib/actualsApi";
import { formatCurrency } from "@/lib/format";

const EMPTY: CustomerInput = {
  name: "",
  credit_period_days: 30,
  credit_buffer_type: "days",
  credit_buffer_value: 7,
  opening_balance: 0,
  category: "",
  notes: "",
  active: true,
};

export function CustomerManager() {
  const [items, setItems] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchCustomers()
      .then(setItems)
      .catch((e) => setError(e.message ?? "Failed to load customers"));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createCustomer(form);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add customer");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteCustomer(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="cfg-section">
      <div className="cfg-section-head">
        <h2>Customers</h2>
        <p>Who owes you money and on what terms — drives your cash inflows.</p>
      </div>

      {error && <p className="cfg-error">{error}</p>}

      <form className="cfg-form" onSubmit={submit}>
        <div className="cfg-field">
          <label>Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Acme Corp"
          />
        </div>
        <div className="cfg-field">
          <label>Credit period (days)</label>
          <input
            type="number"
            min={0}
            value={form.credit_period_days}
            onChange={(e) => setForm({ ...form, credit_period_days: Number(e.target.value) })}
          />
        </div>
        <div className="cfg-field">
          <label>Buffer type</label>
          <select
            value={form.credit_buffer_type}
            onChange={(e) =>
              setForm({ ...form, credit_buffer_type: e.target.value as "days" | "percent" })
            }
          >
            <option value="days">Days (late)</option>
            <option value="percent">% on time</option>
          </select>
        </div>
        <div className="cfg-field">
          <label>Buffer value</label>
          <input
            type="number"
            min={0}
            value={form.credit_buffer_value}
            onChange={(e) => setForm({ ...form, credit_buffer_value: Number(e.target.value) })}
          />
        </div>
        <div className="cfg-field">
          <label>Opening balance (AR owed)</label>
          <input
            type="number"
            min={0}
            value={form.opening_balance}
            onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })}
          />
        </div>
        <div className="cfg-field">
          <label>Category</label>
          <input
            value={form.category ?? ""}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="enterprise"
          />
        </div>
        <div className="cfg-field cfg-field-submit">
          <button type="submit" className="cfg-btn" disabled={busy}>
            {busy ? "Adding…" : "Add customer"}
          </button>
        </div>
      </form>

      <div className="cfg-list">
        {items.length === 0 && <p className="cfg-empty">No customers yet.</p>}
        {items.map((c) => (
          <div key={c.id} className="cfg-row">
            <div className="cfg-row-main">
              <strong>{c.name}</strong>
              <span className="cfg-row-meta">
                Net-{c.credit_period_days}
                {c.credit_buffer_type === "days"
                  ? ` +${c.credit_buffer_value}d`
                  : ` · ${c.credit_buffer_value}% on time`}
                {c.category ? ` · ${c.category}` : ""}
              </span>
            </div>
            <div className="cfg-row-val num">{formatCurrency(c.opening_balance, "INR")}</div>
            <button className="cfg-del" onClick={() => remove(c.id)} title="Delete">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
