/** Pure formatting helpers — no React, easy to unit test. */

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
};

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency.toUpperCase()] ?? "";
}

export function formatCurrency(value: number, currency = "USD", compact = false): string {
  const symbol = currencySymbol(currency);
  if (compact && Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    return `${symbol}${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return `${symbol}${Math.round(value).toLocaleString("en-US")}`;
}

export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}
