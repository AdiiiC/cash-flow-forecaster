/**
 * Business view adapter.
 *
 * This is the ONLY place the technical → business translation lives. It takes a
 * raw `ForecastResponse` (p10/p50/p90 series, runway_weeks, calibration, …) and
 * turns it into plain-English executive concepts the business dashboard renders.
 * Keeping it isolated means the presentation layer never touches percentiles.
 */
import type { ForecastResponse } from "@/lib/api";

export type Trend = "up" | "down" | "flat";
export type MetricPolarity = "higher-is-better" | "lower-is-better";
export type BizIconName =
  | "wallet"
  | "runway"
  | "revenue"
  | "netflow";

export interface BizKpi {
  id: string;
  label: string;
  value: string;
  /** Signed percent change vs the comparison baseline, or null when none. */
  changePct: number | null;
  trend: Trend;
  polarity: MetricPolarity;
  comparisonLabel: string;
  icon: BizIconName;
  hint: string;
}

export interface BizBalancePoint {
  period: string;
  balance: number;
  worstCase: number;
  bestCase: number;
}

export interface BizMoneyMonth {
  month: string;
  moneyIn: number;
  moneyOut: number;
}

export interface BizRevenuePoint {
  month: string;
  revenue: number;
}

export type TakeawayTone = "positive" | "watch" | "neutral";

export interface BizTakeaway {
  id: string;
  tone: TakeawayTone;
  text: string;
}

export interface BusinessView {
  currency: string;
  horizonWeeks: number;
  asOf: string;
  confidenceLabel: string;
  kpis: BizKpi[];
  balanceTrend: BizBalancePoint[];
  cashFlow: BizMoneyMonth[];
  revenueTrend: BizRevenuePoint[];
  takeaways: BizTakeaway[];
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

function monthKey(iso: string): string {
  return MONTH_FMT.format(new Date(`${iso}T00:00:00`));
}

/** Accumulate the opening balance forward along net-flow p10/p50/p90 bounds. */
function buildBalanceTrend(data: ForecastResponse): BizBalancePoint[] {
  const net = data.series.find((s) => s.name === "net_cash_flow");
  if (!net) return [];
  let mid = data.opening_balance;
  let lo = data.opening_balance;
  let hi = data.opening_balance;
  const rows: BizBalancePoint[] = [
    { period: data.as_of, balance: mid, worstCase: lo, bestCase: hi },
  ];
  for (const pt of net.forecast) {
    mid += pt.p50;
    lo += pt.p10;
    hi += pt.p90;
    rows.push({ period: pt.period, balance: mid, worstCase: lo, bestCase: hi });
  }
  return rows;
}

/** Aggregate inflow / outflow forecasts (both positive magnitudes) into months. */
function buildCashFlow(data: ForecastResponse): BizMoneyMonth[] {
  const inflow = data.series.find((s) => s.name === "inflow");
  const outflow = data.series.find((s) => s.name === "outflow");
  if (!inflow || !outflow) return [];

  const order: string[] = [];
  const byMonth = new Map<string, BizMoneyMonth>();

  const bucket = (iso: string): BizMoneyMonth => {
    const key = monthKey(iso);
    let row = byMonth.get(key);
    if (!row) {
      row = { month: key, moneyIn: 0, moneyOut: 0 };
      byMonth.set(key, row);
      order.push(key);
    }
    return row;
  };

  for (const pt of inflow.forecast) bucket(pt.period).moneyIn += Math.max(0, pt.p50);
  for (const pt of outflow.forecast) bucket(pt.period).moneyOut += Math.abs(pt.p50);

  return order.map((k) => {
    const row = byMonth.get(k) as BizMoneyMonth;
    return {
      month: row.month,
      moneyIn: Math.round(row.moneyIn),
      moneyOut: Math.round(row.moneyOut),
    };
  });
}

/** MRR is a monthly level: take the last observed value within each month. */
function buildRevenueTrend(data: ForecastResponse): BizRevenuePoint[] {
  const mrr = data.series.find((s) => s.name === "mrr");
  if (!mrr) return [];

  const recentHistory = mrr.history.slice(-8).map((h) => ({
    period: h.period,
    value: h.value,
  }));
  const forecast = mrr.forecast.map((f) => ({ period: f.period, value: f.p50 }));
  const combined = [...recentHistory, ...forecast];

  const order: string[] = [];
  const lastByMonth = new Map<string, number>();
  for (const pt of combined) {
    const key = monthKey(pt.period);
    if (!lastByMonth.has(key)) order.push(key);
    lastByMonth.set(key, pt.value);
  }
  return order.map((k) => ({ month: k, revenue: Math.round(lastByMonth.get(k) ?? 0) }));
}

function trendOf(changePct: number | null): Trend {
  if (changePct === null || Math.abs(changePct) < 0.05) return "flat";
  return changePct > 0 ? "up" : "down";
}

function pct(from: number, to: number): number | null {
  if (!Number.isFinite(from) || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

function buildKpis(data: ForecastResponse): BizKpi[] {
  const net = data.series.find((s) => s.name === "net_cash_flow");
  const mrr = data.series.find((s) => s.name === "mrr");

  // Cash on hand: projected closing balance vs today's opening.
  const cashChange = pct(data.opening_balance, data.projected_balance_p50);

  // Runway in months (fall back to weeks / 4.33 when insight is absent).
  const runwayMonths =
    data.insight?.runway_months ??
    (data.runway_weeks !== null ? data.runway_weeks / 4.33 : null);
  const runwayValue =
    data.runway_weeks === null
      ? `${(data.horizon_weeks / 4.33).toFixed(1)}+ months`
      : runwayMonths !== null
        ? `${runwayMonths.toFixed(1)} months`
        : "—";

  // Recurring revenue: last forecast month vs first, as a growth read.
  const mrrForecast = mrr?.forecast ?? [];
  const mrrLast = mrrForecast.length ? mrrForecast[mrrForecast.length - 1].p50 : 0;
  const mrrFirst = mrrForecast.length ? mrrForecast[0].p50 : 0;
  const mrrChange = pct(mrrFirst, mrrLast);

  // Net cash flow over the horizon (money in minus money out).
  const netTotal = net ? net.forecast.reduce((a, p) => a + p.p50, 0) : 0;

  return [
    {
      id: "cash-on-hand",
      label: "Projected cash on hand",
      value: fmtInt(data.projected_balance_p50, data.currency),
      changePct: cashChange,
      trend: trendOf(cashChange),
      polarity: "higher-is-better",
      comparisonLabel: `vs ${fmtInt(data.opening_balance, data.currency)} today`,
      icon: "wallet",
      hint: "Your best-estimate cash balance at the end of the forecast window.",
    },
    {
      id: "runway",
      label: "Cash runway",
      value: runwayValue,
      changePct: null,
      trend: data.runway_weeks === null ? "up" : "flat",
      polarity: "higher-is-better",
      comparisonLabel:
        data.runway_weeks === null ? "stays cash-positive" : "until cash runs low",
      icon: "runway",
      hint: "How long your cash lasts at the current pace before it runs out.",
    },
    {
      id: "revenue",
      label: "Recurring revenue",
      value: fmtInt(mrrLast, data.currency),
      changePct: mrrChange,
      trend: trendOf(mrrChange),
      polarity: "higher-is-better",
      comparisonLabel: "projected over the window",
      icon: "revenue",
      hint: "Predictable monthly subscription income — the engine of steady growth.",
    },
    {
      id: "net-flow",
      label: "Net cash flow",
      value: `${netTotal >= 0 ? "+" : ""}${fmtInt(netTotal, data.currency)}`,
      changePct: null,
      trend: netTotal >= 0 ? "up" : "down",
      polarity: "higher-is-better",
      comparisonLabel: `over ${data.horizon_weeks} weeks`,
      icon: "netflow",
      hint: "Money in minus money out. Positive means you're building cash.",
    },
  ];
}

function fmtInt(value: number, currency: string): string {
  const code = (currency || "INR").split("/")[0].toUpperCase();
  const locale = code === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildConfidenceLabel(data: ForecastResponse): string {
  const empirical = data.calibration?.empirical;
  if (empirical == null || !Number.isFinite(empirical)) return "Backtested forecast";
  return `${Math.round(empirical * 100)}% reliable`;
}

function buildTakeaways(data: ForecastResponse): BizTakeaway[] {
  const takeaways: BizTakeaway[] = [];
  const currency = data.currency;

  // 1) Runway / solvency.
  if (data.runway_weeks === null) {
    const months = (data.horizon_weeks / 4.33).toFixed(1);
    takeaways.push({
      id: "runway",
      tone: "positive",
      text: `Your cash position is healthy: you stay cash-positive across the full ${months}-month outlook.`,
    });
  } else {
    const wk = data.runway_weeks;
    takeaways.push({
      id: "runway",
      tone: wk <= 6 ? "watch" : "neutral",
      text: `At the current pace, cash is projected to run low in about ${wk} week${wk === 1 ? "" : "s"}. Worth planning ahead now while you have room to act.`,
    });
  }

  // 2) Net cash flow direction.
  const net = data.series.find((s) => s.name === "net_cash_flow");
  const netTotal = net ? net.forecast.reduce((a, p) => a + p.p50, 0) : 0;
  takeaways.push({
    id: "netflow",
    tone: netTotal >= 0 ? "positive" : "watch",
    text:
      netTotal >= 0
        ? `You're forecast to build roughly ${fmtInt(netTotal, currency)} in net cash over the next ${data.horizon_weeks} weeks.`
        : `Spending is set to outpace income by about ${fmtInt(Math.abs(netTotal), currency)} over the next ${data.horizon_weeks} weeks — a good moment to review your biggest costs.`,
  });

  // 3) Recurring revenue momentum.
  const mrr = data.series.find((s) => s.name === "mrr");
  const mrrForecast = mrr?.forecast ?? [];
  if (mrrForecast.length >= 2) {
    const first = mrrForecast[0].p50;
    const last = mrrForecast[mrrForecast.length - 1].p50;
    const change = pct(first, last);
    if (change !== null) {
      takeaways.push({
        id: "mrr",
        tone: change >= 0 ? "positive" : "watch",
        text:
          change >= 0
            ? `Recurring revenue keeps climbing (about +${change.toFixed(1)}%), the main reason your outlook is improving.`
            : `Recurring revenue is softening (about ${change.toFixed(1)}%) — keep an eye on churn and new sign-ups.`,
      });
    }
  }

  // 4) Fold in a grounded recommendation from the engine, if any.
  const rec = data.insight?.recommendations?.[0];
  if (rec?.message) {
    takeaways.push({
      id: "recommendation",
      tone: rec.kind === "cut" ? "watch" : "neutral",
      text: rec.message,
    });
  }

  return takeaways.slice(0, 4);
}

/** Translate a raw forecast into the business dashboard's view model. */
export function toBusinessView(data: ForecastResponse): BusinessView {
  return {
    currency: data.currency,
    horizonWeeks: data.horizon_weeks,
    asOf: data.as_of,
    confidenceLabel: buildConfidenceLabel(data),
    kpis: buildKpis(data),
    balanceTrend: buildBalanceTrend(data),
    cashFlow: buildCashFlow(data),
    revenueTrend: buildRevenueTrend(data),
    takeaways: buildTakeaways(data),
  };
}
