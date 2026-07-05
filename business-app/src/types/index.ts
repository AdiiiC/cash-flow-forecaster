/**
 * Domain types for the business-facing app.
 *
 * These deliberately model *business* concepts (cash on hand, runway, money in
 * / out) rather than the raw forecaster fields (p10/p50/p90, MASE, conformal
 * coverage). The mock service in `data/mockData.ts` is responsible for the
 * translation from the technical model to these types.
 */

export type View = "landing" | "dashboard";

export type Trend = "up" | "down" | "flat";

/** A green metric is "good when up"; some metrics (like spend) are inverted. */
export type MetricPolarity = "higher-is-better" | "lower-is-better";

export type IconName =
  | "wallet"
  | "runway"
  | "revenue"
  | "netflow"
  | "confidence"
  | "clarity"
  | "foresight"
  | "action";

export interface Kpi {
  id: string;
  label: string;
  /** Preformatted display value, e.g. "$312,400" or "8.5 months". */
  value: string;
  /** Percentage change vs the comparison period (already signed). */
  changePct: number;
  trend: Trend;
  polarity: MetricPolarity;
  comparisonLabel: string;
  icon: IconName;
  /** Plain-English explanation shown on hover / beneath the number. */
  hint: string;
}

/** One week of the projected cash balance line, with a plain-English band. */
export interface BalancePoint {
  week: string;
  /** Best-estimate closing balance for the week. */
  balance: number;
  /** Low end of the likely range (was the p10 band). */
  worstCase: number;
  /** High end of the likely range (was the p90 band). */
  bestCase: number;
}

/** One month of gross cash movement, translated from inflow/outflow series. */
export interface CashFlowMonth {
  month: string;
  moneyIn: number;
  moneyOut: number;
}

/** Monthly recurring revenue trend (business-friendly MRR). */
export interface RevenuePoint {
  month: string;
  revenue: number;
}

export type TakeawayTone = "positive" | "watch" | "neutral";

export interface Takeaway {
  id: string;
  tone: TakeawayTone;
  text: string;
}

export interface Feature {
  id: string;
  icon: IconName;
  title: string;
  description: string;
}

/** Everything the dashboard needs, already translated for business users. */
export interface DashboardData {
  companyName: string;
  currency: string;
  periodLabel: string;
  generatedAt: string;
  /** How reliable the forecast has been historically, in plain English. */
  confidenceLabel: string;
  kpis: Kpi[];
  balanceTrend: BalancePoint[];
  cashFlow: CashFlowMonth[];
  revenueTrend: RevenuePoint[];
  takeaways: Takeaway[];
}
