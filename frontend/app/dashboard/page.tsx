"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ApiError,
  DemoParams,
  ForecastResponse,
  fetchDemoForecast,
} from "@/lib/api";
import { toBusinessView } from "@/lib/businessView";
import { AuthMenu } from "@/components/AuthMenu";
import { BizKpiGrid } from "@/components/business/BizKpiGrid";
import { BizBalanceChart } from "@/components/business/BizBalanceChart";
import { MoneyInOutChart } from "@/components/business/MoneyInOutChart";
import { RevenueTrendChart } from "@/components/business/RevenueTrendChart";
import { KeyTakeaways } from "@/components/business/KeyTakeaways";

const DASHBOARD_PARAMS: DemoParams = {
  weeks: 104,
  seed: 42,
  starting_mrr: 80000,
  opening_balance: 250000,
  currency: "USD",
  thresholds: { min_balance: null, min_runway_weeks: null },
};

type Status = "loading" | "ready" | "error";

export default function DashboardPage() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchDemoForecast(DASHBOARD_PARAMS)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? e.message
            : "Backend unreachable. Is the API running on :8000?",
        );
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => (data ? toBusinessView(data) : null), [data]);

  return (
    <div className="bz">
      <header className="bz-header">
        <div className="bz-header-brand">
          <Link href="/" className="lp-brand">
            <span className="lp-brand-mark bz-mark">CF</span>
            <span className="lp-brand-name">Cash-Flow Forecaster</span>
          </Link>
          {view && (
            <p className="bz-header-meta">
              Executive view · next {view.horizonWeeks} weeks · as of {view.asOf}
            </p>
          )}
        </div>
        <nav className="bz-header-nav">
          <Link href="/forecast">Full forecaster →</Link>
          <AuthMenu onAuthChange={() => undefined} />
        </nav>
      </header>

      <main className="bz-main">
        {status === "loading" && (
          <div className="bz-state">Loading your cash-flow snapshot…</div>
        )}

        {status === "error" && (
          <div className="bz-state bz-state-error">
            <p>{error}</p>
            <Link href="/forecast" className="lp-btn lp-btn-secondary">
              Open the full forecaster
            </Link>
          </div>
        )}

        {status === "ready" && view && (
          <>
            <div className="bz-title">
              <h1>Your cash-flow snapshot</h1>
              <p>A clear read on where your money stands and where it&apos;s heading.</p>
            </div>

            <BizKpiGrid kpis={view.kpis} />

            <div className="bz-row bz-row-wide">
              <section className="bz-panel bz-panel-chart">
                <div className="bz-panel-head">
                  <div>
                    <h2>Projected cash balance</h2>
                    <p>How much cash you&apos;ll have on hand over the coming weeks</p>
                  </div>
                  <span className="bz-badge">{view.confidenceLabel}</span>
                </div>
                <BizBalanceChart data={view.balanceTrend} currency={view.currency} />
              </section>

              <section className="bz-panel">
                <KeyTakeaways takeaways={view.takeaways} />
              </section>
            </div>

            <div className="bz-row bz-row-2">
              <section className="bz-panel bz-panel-chart">
                <div className="bz-panel-head">
                  <div>
                    <h2>Money in vs money out</h2>
                    <p>What you earn compared to what you spend, month by month</p>
                  </div>
                </div>
                <MoneyInOutChart data={view.cashFlow} currency={view.currency} />
              </section>

              <section className="bz-panel bz-panel-chart">
                <div className="bz-panel-head">
                  <div>
                    <h2>Recurring revenue growth</h2>
                    <p>Your predictable monthly income, trending over time</p>
                  </div>
                </div>
                <RevenueTrendChart data={view.revenueTrend} currency={view.currency} />
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="lp-footer">
        <Link href="/">Home</Link>
        <span className="dot-sep">·</span>
        <Link href="/privacy">Data &amp; security</Link>
      </footer>
    </div>
  );
}
