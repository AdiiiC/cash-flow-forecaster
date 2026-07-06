"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { formatGeneratedAt } from "@/lib/format";
import {
  DeterministicProjection,
  fetchDemoProjection,
} from "@/lib/actualsApi";
import { AuthMenu } from "@/components/AuthMenu";
import { ActualsKpis } from "@/components/actuals/ActualsKpis";
import { ActualsBalanceChart } from "@/components/actuals/ActualsBalanceChart";
import { ActualsCashFlowChart } from "@/components/actuals/ActualsCashFlowChart";
import { ActualsBreakdown } from "@/components/actuals/ActualsBreakdown";

type Status = "loading" | "ready" | "error";

export default function ActualsPage() {
  const [data, setData] = useState<DeterministicProjection | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [slowHint, setSlowHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setSlowHint(false);
    const timer = setTimeout(() => {
      if (!cancelled) setSlowHint(true);
    }, 4000);

    fetchDemoProjection({
      opening_balance: 20_000_000,
      currency: "INR",
      horizon_weeks: 13,
    })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setStatus("ready");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Backend unreachable. Is the API running?",
          );
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="bz">
      <header className="bz-header">
        <div className="bz-header-brand">
          <Link href="/" className="lp-brand">
            <span className="lp-brand-mark bz-mark">CF</span>
            <span className="lp-brand-name">Cash-Flow Forecaster</span>
          </Link>
          {data && (
            <p className="bz-header-meta">
              Actuals projection · {data.periods.length} weeks · {formatGeneratedAt(data.generated_at)}
            </p>
          )}
        </div>
        <nav className="bz-header-nav">
          <Link href="/actuals/config">Setup</Link>
          <Link href="/dashboard">Executive view</Link>
          <AuthMenu onAuthChange={() => undefined} />
        </nav>
      </header>

      <main className="bz-main">
        {status === "loading" && (
          <div className="bz-state">
            Loading actuals projection…
            {slowHint && (
              <p className="bz-state-hint">
                Waking the server — the first load after a quiet spell can take up
                to a minute. Thanks for your patience.
              </p>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="bz-state bz-state-error">
            <p>{error}</p>
          </div>
        )}

        {status === "ready" && data && (
          <>
            <div className="bz-title">
              <h1>Cash-flow from actuals</h1>
              <p>
                Deterministic projection based on real sales, purchases, expenses, and
                credit terms — no ML, no guessing.
              </p>
            </div>

            <ActualsKpis data={data} />

            <div className="bz-row bz-row-wide">
              <section className="bz-panel bz-panel-chart">
                <div className="bz-panel-head">
                  <div>
                    <h2>Projected balance</h2>
                    <p>Weekly closing balance rolled forward from opening cash</p>
                  </div>
                </div>
                <ActualsBalanceChart periods={data.periods} currency={data.currency} />
              </section>

              <section className="bz-panel">
                <div className="bz-panel-head">
                  <div>
                    <h2>Source breakdown</h2>
                    <p>Where money is coming from and going to</p>
                  </div>
                </div>
                <ActualsBreakdown
                  inflows={data.inflow_summary}
                  outflows={data.outflow_summary}
                  currency={data.currency}
                />
              </section>
            </div>

            <div className="bz-row bz-row-wide">
              <section className="bz-panel bz-panel-chart">
                <div className="bz-panel-head">
                  <div>
                    <h2>Weekly cash flow</h2>
                    <p>Inflows vs outflows each week</p>
                  </div>
                </div>
                <ActualsCashFlowChart periods={data.periods} currency={data.currency} />
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="bz-footer">
        <Link href="/">Home</Link>
        <span className="dot-sep">·</span>
        <Link href="/dashboard">Dashboard</Link>
        <span className="dot-sep">·</span>
        <Link href="/privacy">Data &amp; security</Link>
      </footer>
    </div>
  );
}
