"use client";

import { useEffect, useState } from "react";

import {
  Supplier,
  SupplierInput,
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
} from "@/lib/actualsApi";
import { formatCurrency } from "@/lib/format";

const EMPTY: SupplierInput = {
  name: "",
  payment_terms_days: 30,
  payment_buffer_type: "days",
  payment_buffer_value: 5,
  opening_balance: 0,
  category: "",
  notes: "",
  active: true,
};

export function SupplierManager() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierInput>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchSuppliers()
      .then(setItems)
      .catch((e) => setError(e.message ?? "Failed to load suppliers"));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createSupplier(form);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add supplier");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteSupplier(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="cfg-section">
      <div className="cfg-section-head">
        <h2>Suppliers</h2>
        <p>Who you owe money and on what terms — drives your cash outflows.</p>
      </div>

      {error && <p className="cfg-error">{error}</p>}

      <form className="cfg-form" onSubmit={submit}>
        <div className="cfg-field">
          <label>Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="AWS India"
          />
        </div>
        <div className="cfg-field">
          <label>Payment terms (days)</label>
          <input
            type="number"
            min={0}
            value={form.payment_terms_days}
            onChange={(e) => setForm({ ...form, payment_terms_days: Number(e.target.value) })}
          />
        </div>
        <div className="cfg-field">
          <label>Buffer type</label>
          <select
            value={form.payment_buffer_type}
            onChange={(e) =>
              setForm({ ...form, payment_buffer_type: e.target.value as "days" | "percent" })
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
            value={form.payment_buffer_value}
            onChange={(e) => setForm({ ...form, payment_buffer_value: Number(e.target.value) })}
          />
        </div>
        <div className="cfg-field">
          <label>Opening balance (AP owed)</label>
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
            placeholder="cloud_infra"
          />
        </div>
        <div className="cfg-field cfg-field-submit">
          <button type="submit" className="cfg-btn" disabled={busy}>
            {busy ? "Adding…" : "Add supplier"}
          </button>
        </div>
      </form>

      <div className="cfg-list">
        {items.length === 0 && <p className="cfg-empty">No suppliers yet.</p>}
        {items.map((s) => (
          <div key={s.id} className="cfg-row">
            <div className="cfg-row-main">
              <strong>{s.name}</strong>
              <span className="cfg-row-meta">
                Net-{s.payment_terms_days}
                {s.payment_buffer_type === "days"
                  ? ` +${s.payment_buffer_value}d`
                  : ` · ${s.payment_buffer_value}% on time`}
                {s.category ? ` · ${s.category}` : ""}
              </span>
            </div>
            <div className="cfg-row-val num">{formatCurrency(s.opening_balance, "INR")}</div>
            <button className="cfg-del" onClick={() => remove(s.id)} title="Delete">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
