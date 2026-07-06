/* API client for the deterministic actuals engine. */

import { API_BASE, ApiError } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CashEvent {
  date: string;
  amount: number;
  direction: "inflow" | "outflow";
  source: string;
  label: string;
}

export interface ProjectionPeriod {
  period_start: string;
  period_end: string;
  inflows: number;
  outflows: number;
  net: number;
  closing_balance: number;
  events: CashEvent[];
}

export interface DeterministicProjection {
  generated_at: string;
  currency: string;
  opening_balance: number;
  closing_balance: number;
  total_inflows: number;
  total_outflows: number;
  net_cash_flow: number;
  runway_weeks: number | null;
  trough_balance: number;
  trough_date: string | null;
  periods: ProjectionPeriod[];
  gst_total: number;
  inflow_summary: Record<string, number>;
  outflow_summary: Record<string, number>;
}

export interface CustomerInput {
  name: string;
  credit_period_days: number;
  credit_buffer_type: "days" | "percent";
  credit_buffer_value: number;
  opening_balance: number;
  category?: string | null;
  notes?: string | null;
  active: boolean;
}

export interface Customer extends CustomerInput {
  id: string;
  created_at: string;
}

export interface SupplierInput {
  name: string;
  payment_terms_days: number;
  payment_buffer_type: "days" | "percent";
  payment_buffer_value: number;
  opening_balance: number;
  category?: string | null;
  notes?: string | null;
  active: boolean;
}

export interface Supplier extends SupplierInput {
  id: string;
  created_at: string;
}

export interface FixedExpenseInput {
  name: string;
  amount: number;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  last_payment_date: string;
  category?: string | null;
  active: boolean;
}

export interface FixedExpense extends FixedExpenseInput {
  id: string;
  user_id: string;
  created_at: string;
}

export interface VariableExpenseInput {
  description: string;
  amount: number;
  expected_date: string;
  category?: string | null;
}

export interface VariableExpense extends VariableExpenseInput {
  id: string;
  user_id: string;
  created_at: string;
}

export interface GSTConfigInput {
  frequency: "monthly" | "quarterly";
  payment_day: number;
  rate_pct: number;
  active: boolean;
}

export interface GSTConfig extends GSTConfigInput {
  id: string;
  user_id: string;
  created_at: string;
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON */
    }
    throw new ApiError(detail);
  }
  return (await res.json()) as T;
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("cff.token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Projection ─────────────────────────────────────────────────────────────

export async function fetchDemoProjection(params: {
  opening_balance?: number;
  currency?: string;
  horizon_weeks?: number;
} = {}): Promise<DeterministicProjection> {
  const sp = new URLSearchParams();
  if (params.opening_balance != null) sp.set("opening_balance", String(params.opening_balance));
  if (params.currency) sp.set("currency", params.currency);
  if (params.horizon_weeks) sp.set("horizon_weeks", String(params.horizon_weeks));

  const res = await fetch(`${API_BASE}/api/actuals/project/demo?${sp}`, {
    method: "POST",
  });
  return handle<DeterministicProjection>(res);
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch(`${API_BASE}/api/actuals/customers`, {
    headers: authHeaders(),
  });
  return handle<Customer[]>(res);
}

export async function createCustomer(inp: CustomerInput): Promise<Customer> {
  const res = await fetch(`${API_BASE}/api/actuals/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(inp),
  });
  return handle<Customer>(res);
}

export async function deleteCustomer(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/actuals/customers/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new ApiError(`Delete failed (${res.status})`);
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function fetchSuppliers(): Promise<Supplier[]> {
  const res = await fetch(`${API_BASE}/api/actuals/suppliers`, {
    headers: authHeaders(),
  });
  return handle<Supplier[]>(res);
}

export async function createSupplier(inp: SupplierInput): Promise<Supplier> {
  const res = await fetch(`${API_BASE}/api/actuals/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(inp),
  });
  return handle<Supplier>(res);
}

export async function deleteSupplier(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/actuals/suppliers/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new ApiError(`Delete failed (${res.status})`);
}

// ─── Fixed Expenses ─────────────────────────────────────────────────────────

export async function fetchFixedExpenses(): Promise<FixedExpense[]> {
  const res = await fetch(`${API_BASE}/api/actuals/expenses/fixed`, {
    headers: authHeaders(),
  });
  return handle<FixedExpense[]>(res);
}

export async function createFixedExpense(inp: FixedExpenseInput): Promise<FixedExpense> {
  const res = await fetch(`${API_BASE}/api/actuals/expenses/fixed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(inp),
  });
  return handle<FixedExpense>(res);
}

export async function deleteFixedExpense(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/actuals/expenses/fixed/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new ApiError(`Delete failed (${res.status})`);
}

// ─── Variable Expenses ──────────────────────────────────────────────────────

export async function fetchVariableExpenses(): Promise<VariableExpense[]> {
  const res = await fetch(`${API_BASE}/api/actuals/expenses/variable`, {
    headers: authHeaders(),
  });
  return handle<VariableExpense[]>(res);
}

export async function createVariableExpense(inp: VariableExpenseInput): Promise<VariableExpense> {
  const res = await fetch(`${API_BASE}/api/actuals/expenses/variable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(inp),
  });
  return handle<VariableExpense>(res);
}

export async function deleteVariableExpense(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/actuals/expenses/variable/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new ApiError(`Delete failed (${res.status})`);
}

// ─── GST Config ─────────────────────────────────────────────────────────────

export async function fetchGSTConfig(): Promise<GSTConfig | null> {
  const res = await fetch(`${API_BASE}/api/actuals/gst`, {
    headers: authHeaders(),
  });
  if (res.status === 401) return null;
  return handle<GSTConfig | null>(res);
}

export async function saveGSTConfig(inp: GSTConfigInput): Promise<GSTConfig> {
  const res = await fetch(`${API_BASE}/api/actuals/gst`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(inp),
  });
  return handle<GSTConfig>(res);
}
