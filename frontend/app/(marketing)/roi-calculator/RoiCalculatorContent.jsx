"use client";
import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { CURRENCIES as ALL_CURRENCIES, useCurrency } from '@/lib/currency';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { ArrowRight, TrendingUp, Sparkles, Info } from 'lucide-react';
import { Reveal } from '@/components/marketing/Motion';
import Button from '@/components/marketing/Button';

// ---- Scenarios ----
const SCENARIOS = [
  { key: 'conservative', label: 'Conservative', burnReduction: 0.03, fxCapture: 0.010,
    hint: 'Cautious estimate — 3% burn reduction, 1.0% FX margin' },
  { key: 'base',         label: 'Base',         burnReduction: 0.06, fxCapture: 0.018,
    hint: 'Median observed across 340+ ClearCash customers' },
  { key: 'optimistic',   label: 'Optimistic',   burnReduction: 0.09, fxCapture: 0.025,
    hint: 'Top-quartile outcome — 9% burn reduction, 2.5% FX margin' },
];

// Use the shared currency list from global context
const CURRENCIES = ALL_CURRENCIES;

function fmt(n, symbol = '$') {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${symbol}${(n / 1_000).toFixed(1)}K`;
  return `${symbol}${Math.round(n).toLocaleString()}`;
}

function buildProjection(cash, burn, months, burnReduction, fxMonthly) {
  const rows = [];
  let a = cash;
  let b = cash;
  for (let m = 0; m <= months; m++) {
    rows.push({
      m,
      label: m === 0 ? 'Now' : `+${m}mo`,
      current: Math.max(0, Math.round(a)),
      clearcash: Math.max(0, Math.round(b)),
    });
    a -= burn;
    b -= burn * (1 - burnReduction);
    b += fxMonthly;
  }
  return rows;
}

function computeRunway(cash, netMonthly) {
  if (netMonthly <= 0) return Infinity;
  return cash / netMonthly;
}

export default function RoiCalculator() {
  const [cash, setCash] = useState(300_000);
  const [burn, setBurn] = useState(45_000);
  const [xborder, setXborder] = useState(20_000);
  const [horizon] = useState(24);
  const [sceneIdx, setSceneIdx] = useState(1); // default: Base
  const { currency: globalCurrency, setCurrency: setGlobalCurrency } = useCurrency();
  const [currIdx, setCurrIdx] = useState(
    () => CURRENCIES.findIndex((c) => c.code === globalCurrency.code) ?? 0
  );

  // Keep local picker in sync when global currency changes (e.g. changed in Navbar)
  useEffect(() => {
    const idx = CURRENCIES.findIndex((c) => c.code === globalCurrency.code);
    if (idx >= 0) setCurrIdx(idx);
  }, [globalCurrency.code]);

  const scene = SCENARIOS[sceneIdx];
  const curr = CURRENCIES[currIdx];
  const f = (n) => fmt(n, curr.symbol);

  // Propagate local selection to the global context
  const handleCurrChange = (i) => {
    setCurrIdx(i);
    setGlobalCurrency(CURRENCIES[i]);
  };

  const result = useMemo(() => {
    const burnReduction = scene.burnReduction;
    const fxCapture = scene.fxCapture;
    const fxMonthlySavings = xborder * fxCapture;

    const currentRunway = computeRunway(cash, burn);
    const clearcashNetMonthly = burn * (1 - burnReduction) - fxMonthlySavings;
    const newRunway = computeRunway(cash, clearcashNetMonthly);

    const runwayGain = newRunway - currentRunway;
    const yearlySavings = burn * burnReduction * 12 + fxMonthlySavings * 12;

    const data = buildProjection(cash, burn, horizon, burnReduction, fxMonthlySavings);

    return {
      currentRunway: Number.isFinite(currentRunway) ? currentRunway : 999,
      newRunway: Number.isFinite(newRunway) ? newRunway : 999,
      runwayGain: Number.isFinite(runwayGain) ? runwayGain : 999,
      yearlySavings,
      fxMonthlySavings,
      burnReduction,
      data,
    };
  }, [cash, burn, xborder, horizon, scene]);

  return (
    <div>
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pt-20 pb-10" data-testid="roi-hero">
        <Reveal>
          <p className="overline">ROI calculator</p>
          <h1 className="mt-3 text-[38px] sm:text-[52px] lg:text-[60px] font-medium tracking-tightest leading-[1.05] text-white max-w-3xl">
            Your runway. Ours vs. yours.
          </h1>
          <p className="mt-5 text-[15.5px] text-muted max-w-2xl leading-relaxed">
            Plug in three numbers. See how many months of runway ClearCash unlocks —
            through smarter burn intelligence and FX-at-payment pricing.
          </p>
        </Reveal>

        {/* Scenario tabs */}
        <div className="mt-8 flex items-center gap-2 flex-wrap" data-testid="roi-scenario-tabs">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setSceneIdx(i)}
              data-testid={`roi-scenario-${s.key}`}
              className={`text-[12.5px] px-4 py-1.5 rounded-btn hairline transition-colors ${
                sceneIdx === i ? 'bg-elevated text-white' : 'bg-surface text-muted hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
          <span className="text-[11.5px] text-muted ml-1">{scene.hint}</span>
        </div>

        {/* Currency switcher */}
        <div className="mt-4 flex items-center gap-1.5" data-testid="roi-currency-switcher">
          <span className="overline mr-1">Currency</span>
          {CURRENCIES.map((c, i) => (
            <button
              key={c.code}
              onClick={() => handleCurrChange(i)}
              data-testid={`roi-currency-${c.code.toLowerCase()}`}
              className={`text-[11.5px] px-2.5 py-1 rounded-btn hairline transition-colors num ${
                currIdx === i ? 'bg-elevated text-white' : 'bg-surface text-muted hover:text-white'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-20">
        <div className="grid lg:grid-cols-12 gap-4">
          {/* Inputs */}
          <div
            className="lg:col-span-4 bg-surface hairline rounded-card p-7 h-fit"
            data-testid="roi-inputs"
          >
            <p className="overline">Your numbers</p>

            <MoneyField
              label="Cash on hand"
              value={cash}
              onChange={setCash}
              min={10_000}
              max={5_000_000}
              step={10_000}
              symbol={curr.symbol}
              testid="roi-input-cash"
            />
            <MoneyField
              label="Monthly burn"
              value={burn}
              onChange={setBurn}
              min={2_000}
              max={500_000}
              step={1_000}
              symbol={curr.symbol}
              testid="roi-input-burn"
            />
            <MoneyField
              label="Monthly cross-border revenue"
              value={xborder}
              onChange={setXborder}
              min={0}
              max={500_000}
              step={1_000}
              symbol={curr.symbol}
              testid="roi-input-xborder"
              hint="Revenue you invoice or bill in a non-home currency."
            />

            <div className="mt-8 pt-6 hairline-t">
              <div className="flex items-start gap-2 text-[11.5px] text-muted leading-relaxed">
                <Info size={12} className="text-accent shrink-0 mt-0.5" />
                <p>
                  Model assumes a <span className="num text-white">6%</span> burn reduction from AI takeaways and a
                  <span className="num text-white"> 1.8%</span> margin captured on FX-priced invoices — the median observed across 340+ ClearCash customers.
                </p>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-8 space-y-4">
            <div className="grid sm:grid-cols-3 gap-2">
              <StatCard
                label="Your runway today"
                value={
                  result.currentRunway >= 999
                    ? 'Profitable'
                    : `${result.currentRunway.toFixed(1)} mo`
                }
                sub={`At ${f(burn)}/mo net burn`}
                testid="roi-current-runway"
              />
              <StatCard
                label="With ClearCash"
                value={
                  result.newRunway >= 999
                    ? 'Profitable'
                    : `${result.newRunway.toFixed(1)} mo`
                }
                sub={`${scene.label} scenario`}
                accent
                testid="roi-new-runway"
              />
              <StatCard
                label="Runway extension"
                value={
                  result.runwayGain >= 999
                    ? '—'
                    : `+${result.runwayGain.toFixed(1)} mo`
                }
                sub={`≈ ${f(result.yearlySavings)} / year saved`}
                positive
                testid="roi-runway-gain"
              />
            </div>

            {/* Chart */}
            <div className="bg-surface hairline rounded-card p-7" data-testid="roi-chart-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="overline">Projected cash · next {horizon} months</p>
                  <p className="text-[12.5px] text-muted mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#a1a1aa] mr-1.5 align-middle" />
                    Your current path
                    <span className="mx-3 text-muted/50">·</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-accent mr-1.5 align-middle" />
                    With ClearCash
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-positive">
                  <TrendingUp size={13} />
                  <span className="num">
                    {result.runwayGain >= 999 ? '∞' : `+${result.runwayGain.toFixed(1)} mo`}
                  </span>
                </div>
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={result.data}
                    margin={{ top: 10, right: 8, left: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="ccFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e0a34a" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="#e0a34a" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'ui-monospace' }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.floor(horizon / 6)}
                    />
                    <YAxis
                      tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'ui-monospace' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => f(v)}
                      width={54}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#171c27',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#ffffff',
                      }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(v, name) => [f(v), name === 'current' ? 'Your path' : 'ClearCash']}
                      cursor={{ stroke: '#e0a34a', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <ReferenceLine y={0} stroke="#e0644f" strokeDasharray="3 3" strokeOpacity={0.4} />
                    <Area
                      type="monotone"
                      dataKey="current"
                      stroke="#a1a1aa"
                      strokeWidth={1.5}
                      fill="url(#currentFill)"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="clearcash"
                      stroke="#e0a34a"
                      strokeWidth={2}
                      fill="url(#ccFill)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI takeaway */}
            <div className="bg-surface hairline rounded-card p-6 flex gap-3" data-testid="roi-takeaway">
              <div className="flex gap-3">
              <div className="w-8 h-8 shrink-0 rounded-btn bg-elevated hairline flex items-center justify-center">
                <Sparkles size={14} className="text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-[13.5px] text-white leading-relaxed">
                  With <span className="num text-accent">{f(cash)}</span> in cash and <span className="num text-negative">{f(burn)}</span>/mo burn, the <span className="text-white font-medium">{scene.label}</span> scenario extends your runway by <span className="num text-positive">{result.runwayGain >= 999 ? '∞' : `${result.runwayGain.toFixed(1)} months`}</span>{result.fxMonthlySavings > 0 && (
                    <> — <span className="num text-white">{f(result.fxMonthlySavings)}</span>/mo of that comes from FX-at-payment pricing on cross-border invoices.</>
                  )}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    href={`/contact?cash=${cash}&burn=${burn}&xborder=${xborder}&gain=${result.runwayGain >= 999 ? 99 : result.runwayGain.toFixed(1)}&scene=${scene.key}&ccy=${curr.code}`}
                    size="md"
                    data-testid="roi-cta-primary"
                  >
                    Start free with these numbers
                    <ArrowRight size={13} />
                  </Button>
                  <Link
                    href="/features"
                    className="text-[12.5px] text-muted hover:text-white transition-colors"
                    data-testid="roi-cta-secondary"
                  >
                    How the model works →
                  </Link>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust band */}
      <section className="hairline-t">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-12 grid sm:grid-cols-3 gap-6 text-center">
          <div>
            <p className="num text-[24px] text-white">340+</p>
            <p className="text-[12px] text-muted mt-1">Founders modelling with ClearCash</p>
          </div>
          <div>
            <p className="num text-[24px] text-white">94%</p>
            <p className="text-[12px] text-muted mt-1">13-week forecasts within ±10%</p>
          </div>
          <div>
            <p className="num text-[24px] text-white">20 min</p>
            <p className="text-[12px] text-muted mt-1">From signup to first forecast</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---- Sub-components ----
function MoneyField({ label, value, onChange, min, max, step, testid, hint, symbol = '$' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-2">
        <label className="overline">{label}</label>
        <span className="num text-[14px] text-white" data-testid={`${testid}-display`}>
          {symbol}{value.toLocaleString()}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cc-range w-full"
        style={{
          background: `linear-gradient(to right, #e0a34a 0%, #e0a34a ${pct}%, #1e2431 ${pct}%, #1e2431 100%)`,
        }}
        data-testid={testid}
      />
      <div className="mt-1 flex justify-between text-[10.5px] num text-muted/60">
        <span>{symbol}{min.toLocaleString()}</span>
        <span>{symbol}{max.toLocaleString()}</span>
      </div>
      {hint && <p className="mt-2 text-[11.5px] text-muted leading-relaxed">{hint}</p>}
    </div>
  );
}

function StatCard({ label, value, sub, accent, positive, testid }) {
  return (
    <div
      className={`hairline rounded-card p-6 ${accent ? 'bg-elevated' : 'bg-surface'}`}
      style={accent ? { borderColor: 'rgba(224,163,74,0.28)' } : undefined}
      data-testid={testid}
    >
      <p className="overline">{label}</p>
      <p
        className={`num text-[26px] mt-3 leading-none ${
          accent ? 'text-accent' : positive ? 'text-positive' : 'text-white'
        }`}
      >
        {value}
      </p>
      <p className="text-[11.5px] text-muted mt-2">{sub}</p>
    </div>
  );
}
