"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { isAuthenticated, onAuthChange } from "@/lib/api";
import { AuthMenu } from "@/components/AuthMenu";
import { CustomerManager } from "@/components/actuals/config/CustomerManager";
import { SupplierManager } from "@/components/actuals/config/SupplierManager";
import { FixedExpenseManager } from "@/components/actuals/config/FixedExpenseManager";
import { VariableExpenseManager } from "@/components/actuals/config/VariableExpenseManager";
import { GSTManager } from "@/components/actuals/config/GSTManager";

type Tab = "customers" | "suppliers" | "fixed" | "variable" | "gst";

const TABS: { id: Tab; label: string }[] = [
  { id: "customers", label: "Customers" },
  { id: "suppliers", label: "Suppliers" },
  { id: "fixed", label: "Fixed expenses" },
  { id: "variable", label: "Variable expenses" },
  { id: "gst", label: "GST" },
];

export default function ConfigPage() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("customers");

  useEffect(() => {
    setAuthed(isAuthenticated());
    setReady(true);
    return onAuthChange(() => setAuthed(isAuthenticated()));
  }, []);

  return (
    <div className="bz">
      <header className="bz-header">
        <div className="bz-header-brand">
          <Link href="/" className="lp-brand">
            <span className="lp-brand-mark bz-mark">CF</span>
            <span className="lp-brand-name">Cash-Flow Forecaster</span>
          </Link>
          <p className="bz-header-meta">Setup &amp; configuration</p>
        </div>
        <nav className="bz-header-nav">
          <Link href="/actuals">Actuals view</Link>
          <AuthMenu onAuthChange={() => setAuthed(isAuthenticated())} />
        </nav>
      </header>

      <main className="bz-main">
        <div className="bz-title">
          <h1>Business setup</h1>
          <p>
            Configure the masters that drive your deterministic cash-flow projection:
            customers, suppliers, expenses, and GST.
          </p>
        </div>

        {ready && !authed && (
          <div className="bz-state">
            <p>Please sign in to manage your business configuration.</p>
            <p className="bz-state-hint">
              Use the “Sign in” button in the top-right to create an account or log in.
            </p>
          </div>
        )}

        {ready && authed && (
          <>
            <div className="cfg-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`cfg-tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <section className="bz-panel cfg-panel">
              {tab === "customers" && <CustomerManager />}
              {tab === "suppliers" && <SupplierManager />}
              {tab === "fixed" && <FixedExpenseManager />}
              {tab === "variable" && <VariableExpenseManager />}
              {tab === "gst" && <GSTManager />}
            </section>
          </>
        )}
      </main>

      <footer className="bz-footer">
        <Link href="/">Home</Link>
        <span className="dot-sep">·</span>
        <Link href="/actuals">Actuals</Link>
        <span className="dot-sep">·</span>
        <Link href="/dashboard">Dashboard</Link>
      </footer>
    </div>
  );
}
