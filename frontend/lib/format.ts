/* Presentation helpers. All financial figures render with a monospace face
   and explicit sign/units so a reader never has to guess magnitude. */

// Locale per currency so grouping matches convention (e.g. INR uses the
// Indian lakh/crore system: ₹2,50,000 rather than ₹250,000).
const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  INR: "en-IN",
};

export function formatCurrency(value: number, currency = "INR", compact = false): string {
  const code = (currency || "INR").split("/")[0].toUpperCase();
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

/** Format a timestamp in the viewer's own system time zone, e.g.
    "Jul 5, 2026, 09:14 GMT+5:30". The time + zone are resolved from the
    browser's locale/timezone so it always reflects the local system clock. */
export function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
  return `${date}, ${time}`;
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
