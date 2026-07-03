"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  DemoParams,
  ForecastResponse,
  FxRates,
  ProgressEvent,
  RunSummary,
  ScenarioInput,
  clearRuns,
  fetchDemoForecast,
  fetchFxRates,
  fetchRun,
  fetchRuns,
  streamDemoForecast,
  uploadForecast,
} from "@/lib/api";
import { AlertsBanner } from "@/components/AlertsBanner";
import { BalanceChart } from "@/components/BalanceChart";
import { CalibrationBadge } from "@/components/CalibrationBadge";
import { CategoryWaterfall } from "@/components/CategoryWaterfall";
import { Controls } from "@/components/Controls";
import { DriverBars } from "@/components/DriverBars";
import { ExportBar } from "@/components/ExportBar";
import { KpiCards } from "@/components/KpiCards";
import { NarrativePanel } from "@/components/NarrativePanel";
import { ProgressBar } from "@/components/ProgressBar";
import { RunHistory } from "@/components/RunHistory";
import { RunwayHero } from "@/components/RunwayHero";
import { ScenarioPanel } from "@/components/ScenarioPanel";
import { SeriesPanel } from "@/components/SeriesPanel";
import { TrustStrip } from "@/components/TrustStrip";
import { ErrorState } from "@/components/StateViews";

const DEFAULT_PARAMS: DemoParams = {
  weeks: 104,
  seed: 42,
  starting_mrr: 80000,
  opening_balance: 250000,
  currency: "USD",
  thresholds: { min_balance: null, min_runway_weeks: null },
};

const DEFAULT_SCENARIO: ScenarioInput = {
  label: "Scenario",
  revenue_growth_pct: 2,
  cost_multiplier: 0.9,
  one_off_amount: 0,
  one_off_direction: "inflow",
  one_off_week: 4,
};

const FX_CYCLE = ["USD", "INR"];

type Status = "loading" | "ready" | "error";

export default function Page() {
  const [params, setParams] = useState<DemoParams>(DEFAULT_PARAMS);
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [rates, setRates] = useState<FxRates | null>(null);
  const [fxTo, setFxTo] = useState<string | null>(null);

  const [scenarioInput, setScenarioInput] = useState<ScenarioInput>(DEFAULT_SCENARIO);
  const abortRef = useRef<AbortController | null>(null);

  const refreshRuns = useCallback(() => {
    fetchRuns(25)
      .then(setRuns)
      .catch(() => {
        /* history is non-critical */
      });
  }, []);

  const runDemo = useCallback(
    async (p: DemoParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      setError("");
      setProgress({ fraction: 0.02, message: "Connecting…" });
      setActiveRunId(null);
      try {
        const result = await streamDemoForecast(p, setProgress, controller.signal);
        setData(result);
        setStatus("ready");
        refreshRuns();
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(
          e instanceof ApiError ? e.message : "Backend unreachable. Is the API running on :8000?",
        );
        setStatus("error");
      }
    },
    [refreshRuns],
  );

  const runUpload = useCallback(
    async (file: File, openingBalance: number) => {
      setStatus("loading");
      setError("");
      setProgress({ fraction: 0.2, message: "Parsing & forecasting upload…" });
      setActiveRunId(null);
      try {
        setData(await uploadForecast(file, openingBalance));
        setStatus("ready");
        refreshRuns();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Upload failed.");
        setStatus("error");
      }
    },
    [refreshRuns],
  );

  const applyScenario = useCallback(async () => {
    setStatus("loading");
    setProgress({ fraction: 0.5, message: "Applying scenario…" });
    try {
      const result = await fetchDemoForecast({ ...params, scenario: scenarioInput });
      setData(result);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Scenario failed.");
      setStatus("error");
    }
  }, [params, scenarioInput]);

  const clearScenario = useCallback(async () => {
    try {
      const result = await fetchDemoForecast({ ...params, scenario: null });
      setData(result);
    } catch {
      /* keep current */
    }
  }, [params]);

  const selectRun = useCallback(async (id: string) => {
    setStatus("loading");
    setError("");
    setProgress({ fraction: 0.5, message: "Loading saved run…" });
    try {
      setData(await fetchRun(id));
      setActiveRunId(id);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load run.");
      setStatus("error");
    }
  }, []);

  const clearHistory = useCallback(async () => {
    if (!window.confirm("Clear all saved runs? This cannot be undone.")) return;
    try {
      await clearRuns();
      setActiveRunId(null);
      refreshRuns();
    } catch {
      /* non-fatal: leave history as-is */
    }
  }, [refreshRuns]);

  const cycleFx = () => {
    setFxTo((prev) => {
      if (prev === null) return FX_CYCLE.find((c) => c !== data?.currency) ?? null;
      const idx = FX_CYCLE.indexOf(prev);
      const next = FX_CYCLE[(idx + 1) % FX_CYCLE.length];
      return next === data?.currency ? null : next;
    });
  };

  useEffect(() => {
    runDemo(DEFAULT_PARAMS);
    refreshRuns();
    fetchFxRates().then(setRates).catch(() => undefined);
  }, [runDemo, refreshRuns]);

  return (
    <main className="app">
      <header className="masthead">
        <div>
          <h1>Cash-Flow Forecaster</h1>
          <div className="sub">
            See where your cash is heading over the next 13 weeks — with an honest
            best estimate and a realistic range, not a blind guess.
          </div>
          <div className="sub-tech" title="The engineering underneath">
            Probabilistic forecasting · calibrated intervals · backtested · AI briefing grounded in the numbers
          </div>
        </div>
        {data && (
          <div className="meta num">
            <div className="meta-badges">
              {data.cached && <span className="badge">cached</span>}
              <CalibrationBadge calibration={data.calibration} />
              <button className="mini-btn wide" onClick={cycleFx} title="Show approximate FX conversion">
                {fxTo ? `≈ ${fxTo}` : "FX ≈"}
              </button>
            </div>
            <div>generated {new Date(data.generated_at).toISOString().slice(0, 16).replace("T", " ")}Z</div>
            <div>horizon {data.horizon_weeks}w · {data.currency}</div>
          </div>
        )}
      </header>

      <Controls
        params={params}
        onParamsChange={setParams}
        onRunDemo={() => runDemo(params)}
        onUpload={runUpload}
        loading={status === "loading"}
      />

      {status === "loading" && <ProgressBar progress={progress} />}
      {status === "error" && <ErrorState message={error} onRetry={() => runDemo(params)} />}

      {status === "ready" && data && (
        <div className="layout">
          <RunHistory
            runs={runs}
            activeId={activeRunId}
            onSelect={selectRun}
            onRefresh={refreshRuns}
            onClear={clearHistory}
            loading={false}
          />

          <div className="content">
            <AlertsBanner alerts={data.alerts} />
            <RunwayHero data={data} />
            <KpiCards data={data} fxTo={fxTo} rates={rates} />

            <TrustStrip data={data} />

            <div className="panel">
              <div className="panel-head">
                <h2>Where your cash is heading</h2>
                <div className="head-actions">
                  <span className="badge" title="The solid line is our best estimate; the shaded band is the likely range (8 in 10 outcomes).">
                    best estimate + likely range
                  </span>
                  <ExportBar data={data} />
                </div>
              </div>
              <BalanceChart data={data} />
            </div>

            <NarrativePanel narrative={data.narrative} />

            <ScenarioPanel
              input={scenarioInput}
              onChange={setScenarioInput}
              onApply={applyScenario}
              onClear={clearScenario}
              data={data}
              loading={false}
            />

            <div className="two-col">
              <CategoryWaterfall
                opening={data.opening_balance}
                categories={data.categories}
                currency={data.currency}
                horizonWeeks={data.horizon_weeks}
              />
              <DriverBars drivers={data.drivers} currency={data.currency} />
            </div>

            <div className="section-label">
              <h2>The detail behind the forecast</h2>
              <p>
                Each chart shows recent history and the forecast ahead. The solid
                line is the best estimate; the shaded band is the likely range.
                Badges show how accurate each one was when tested on past data.
              </p>
            </div>

            <div className="series-grid">
              {data.series.map((s) => (
                <SeriesPanel key={s.name} series={s} />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
