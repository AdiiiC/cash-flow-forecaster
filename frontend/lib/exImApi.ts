/**
 * ExIm (Export/Import) API client.
 * Mirrors app/schemas.py ExImInvoice* shapes.
 */

import { API_BASE, ApiError, getToken } from "@/lib/api";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const b = await res.json();
      if (b?.detail) detail = String(b.detail);
    } catch { /* non-JSON */ }
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type InvoiceKind = "receivable" | "payable";
export type InvoiceStatus = "open" | "paid" | "void";

export interface ExImInvoiceInput {
  kind: InvoiceKind;
  counterparty: string;
  fcy_code: string;
  fcy_amount: number;
  base_currency: string;
  payment_terms_days: number;
  issue_date: string;          // ISO date
  category?: string | null;
  notes?: string | null;
}

export interface ExImInvoice extends ExImInvoiceInput {
  id: string;
  created_at: string;
  due_date: string;
  spot_rate: number;
  predicted_rate_p50: number;
  predicted_rate_p10: number;
  predicted_rate_p90: number;
  base_amount_p50: number;
  base_amount_p10: number;
  base_amount_p90: number;
  rate_model: string;
  predicted_at: string;
  status: InvoiceStatus;
  overdue: boolean;
}

export interface FxQuote {
  pair: string;
  horizon_days: number;
  rate_p50: number;
  rate_p10: number;
  rate_p90: number;
  spot_today: number;
  model: string;
  as_of: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchExIm(): Promise<ExImInvoice[]> {
  const res = await fetch(`${API_BASE}/api/exim`, {
    headers: authHeaders(),
  });
  return handle<ExImInvoice[]>(res);
}

export async function createExIm(body: ExImInvoiceInput): Promise<ExImInvoice> {
  const res = await fetch(`${API_BASE}/api/exim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handle<ExImInvoice>(res);
}

export async function updateExImStatus(
  id: string,
  status: InvoiceStatus,
): Promise<ExImInvoice> {
  const res = await fetch(`${API_BASE}/api/exim/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status }),
  });
  return handle<ExImInvoice>(res);
}

export async function deleteExIm(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/exim/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handle<unknown>(res);
}

export async function fetchFxQuote(
  base: string,
  quote: string,
  days: number,
): Promise<FxQuote> {
  const params = new URLSearchParams({ base, quote, days: String(days) });
  const res = await fetch(`${API_BASE}/api/exim/fx/predict?${params}`, {
    headers: authHeaders(),
  });
  return handle<FxQuote>(res);
}
