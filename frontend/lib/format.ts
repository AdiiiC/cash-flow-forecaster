/* Presentation helpers. All financial figures render with a monospace face
   and explicit sign/units so a reader never has to guess magnitude. */

// Locale per currency so grouping matches convention (e.g. INR uses the
// Indian lakh/crore system: ₹2,50,000 rather than ₹250,000).
const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  INR: "en-IN",
};

export function formatCurrency(value: number, currency = "USD", compact = false): string {
  const code = (currency || "USD").split("/")[0].toUpperCase();
  const locale = CURRENCY_LOCALE[code] ?? "en-US";
  const opts: Intl.NumberFormatOptions = {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
    ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
  };
  return new Intl.NumberFormat(locale, opts).format(value);
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatWeekLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Convert an amount between currencies using USD-based rates (units per 1 USD). */
export function convertAmount(
  value: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  const f = rates[from.toUpperCase()] ?? 1;
  const t = rates[to.toUpperCase()] ?? 1;
  return (value / f) * t;
}
