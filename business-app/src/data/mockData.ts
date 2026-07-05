/**
 * Mock data service.
 *
 * This is the ONLY place the "technical → business" translation lives. In the
 * real product this module would call the Cash-Flow-Forecaster API
 * (`/api/forecast`) and map its raw response — p10/p50/p90 series, runway_weeks,
 * MRR, conformal coverage — into the business types the UI consumes. Keeping it
 * isolated means the presentation layer never sees database terminology.
 */
import type {
  BalancePoint,
  CashFlowMonth,
  DashboardData,
  Feature,
  Kpi,
  RevenuePoint,
  Takeaway,
} from "@/types";

// --- Landing page content ----------------------------------------------------

export const features: Feature[] = [
  {
    id: "clarity",
    icon: "clarity",
    title: "See your cash at a glance",
    description:
      "No spreadsheets, no jargon. One clean view shows how much cash you have and where it's heading over the next quarter.",
  },
  {
    id: "foresight",
    icon: "foresight",
    title: "Know your runway before it's a problem",
    description:
      "We project how long your cash lasts and flag the exact week things get tight — while you still have time to act.",
  },
  {
    id: "action",
    icon: "action",
    title: "Get plain-English next steps",
    description:
      "Every number comes with a takeaway: what it means for your business and the one move that improves it most.",
  },
];

// --- Dashboard: KPI summary cards --------------------------------------------
// Each card translates a raw forecaster output into an executive metric.

const kpis: Kpi[] = [
  {
    id: "cash-on-hand",
    label: "Cash on Hand",
    value: "$312,400",
    changePct: 4.2,
    trend: "up",
    polarity: "higher-is-better",
    comparisonLabel: "vs last month",
    icon: "wallet",
    hint: "Projected closing balance this month — the money actually available to spend.",
  },
  {
    id: "runway",
    label: "Runway",
    value: "8.5 months",
    changePct: 6.1,
    trend: "up",
    polarity: "higher-is-better",
    comparisonLabel: "vs last month",
    icon: "runway",
    hint: "How long your cash lasts at the current burn rate before it runs out.",
  },
  {
    id: "revenue",
    label: "Recurring Revenue",
    value: "$86,200",
    changePct: 3.4,
    trend: "up",
    polarity: "higher-is-better",
    comparisonLabel: "vs last month",
    icon: "revenue",
    hint: "Predictable subscription income each month — the engine of steady growth.",
  },
  {
    id: "net-flow",
    label: "Net Cash Flow",
    value: "+$18,900",
    changePct: -2.3,
    trend: "down",
    polarity: "higher-is-better",
    comparisonLabel: "vs last month",
    icon: "netflow",
    hint: "Money in minus money out this month. Positive means you're building cash.",
  },
];

// --- Dashboard: projected cash balance (line chart) --------------------------
// Adapted from the p50 balance path, with p10/p90 shown as a plain-English band.

const balanceTrend: BalancePoint[] = [
  { week: "This week", balance: 312400, worstCase: 312400, bestCase: 312400 },
  { week: "Wk 2", balance: 318100, worstCase: 305200, bestCase: 331500 },
  { week: "Wk 4", balance: 322800, worstCase: 299400, bestCase: 346900 },
  { week: "Wk 6", balance: 331500, worstCase: 296100, bestCase: 367800 },
  { week: "Wk 8", balance: 327900, worstCase: 283400, bestCase: 372900 },
  { week: "Wk 10", balance: 335600, worstCase: 278200, bestCase: 393600 },
  { week: "Wk 12", balance: 344200, worstCase: 274900, bestCase: 414100 },
  { week: "Wk 13", balance: 351800, worstCase: 271300, bestCase: 432500 },
];

// --- Dashboard: money in vs money out (bar chart) ----------------------------
// Adapted from the inflow / outflow forecast series, aggregated to months.

const cashFlow: CashFlowMonth[] = [
  { month: "Feb", moneyIn: 92800, moneyOut: 81400 },
  { month: "Mar", moneyIn: 98200, moneyOut: 84900 },
  { month: "Apr", moneyIn: 101600, moneyOut: 88300 },
  { month: "May", moneyIn: 106400, moneyOut: 87500 },
  { month: "Jun", moneyIn: 112900, moneyOut: 94000 },
  { month: "Jul", moneyIn: 118300, moneyOut: 99400 },
];

// --- Dashboard: recurring revenue trend (line chart) -------------------------

const revenueTrend: RevenuePoint[] = [
  { month: "Feb", revenue: 74200 },
  { month: "Mar", revenue: 76900 },
  { month: "Apr", revenue: 79100 },
  { month: "May", revenue: 81600 },
  { month: "Jun", revenue: 83800 },
  { month: "Jul", revenue: 86200 },
];

// --- Dashboard: Key Takeaways -------------------------------------------------
// Improvised, readable synthesis of what the technical forecast actually means.

const takeaways: Takeaway[] = [
  {
    id: "t1",
    tone: "positive",
    text: "Your cash position is healthy: at the current pace you have roughly 8.5 months of runway, up from 8.0 last month.",
  },
  {
    id: "t2",
    tone: "watch",
    text: "Spending grew slightly faster than income this month, nudging net cash flow down 2%. Worth a quick look at your biggest expenses.",
  },
  {
    id: "t3",
    tone: "neutral",
    text: "Recurring revenue keeps climbing steadily (+3.4%), which is the main reason your outlook improved over the quarter.",
  },
];

// --- Assembled dashboard payload ---------------------------------------------

export const dashboardData: DashboardData = {
  companyName: "Northwind Coffee Roasters",
  currency: "USD",
  periodLabel: "Next 13 weeks",
  generatedAt: "2026-07-05",
  confidenceLabel: "94% reliable",
  kpis,
  balanceTrend,
  cashFlow,
  revenueTrend,
  takeaways,
};

/**
 * Simulates fetching the dashboard from an API. Kept async so swapping in the
 * real Cash-Flow-Forecaster backend later is a one-line change.
 */
export function fetchDashboardData(): Promise<DashboardData> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(dashboardData), 350);
  });
}
