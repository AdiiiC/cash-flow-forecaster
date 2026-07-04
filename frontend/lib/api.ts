/* Typed contracts mirroring the backend Pydantic schemas. */

export interface HistoryPoint {
  period: string;
  value: number;
}

export interface ForecastPoint {
  period: string;
  p10: number;
  p50: number;
  p90: number;
}

export interface BacktestMetrics {
  mase: number;
  pinball: number;
  coverage_80: number;
  n_origins: number;
}

export interface SeriesForecast {
  name: string;
  label: string;
  unit: string;
  model: string;
  candidates: Record<string, number>;
  metrics: BacktestMetrics;
  history: HistoryPoint[];
  forecast: ForecastPoint[];
}

export interface Narrative {
  text: string;
  source: string; // "gemini" | "openai" | "anthropic" | "template"
  model?: string | null;
  grounded: boolean;
  used_values: Record<string, number>;
}

export type Direction = "inflow" | "outflow";

export interface CategoryFlow {
  category: string;
  direction: Direction;
  hist_weekly_mean: number;
  hist_total: number;
  share: number;
  projected_total: number;
  volatility: number;
}

export interface Driver {
  category: string;
  direction: Direction;
  impact: number;
  share_of_net_abs: number;
  volatility: number;
}

export interface IntervalCalibration {
  target: number;
  empirical: number;
  conformal: boolean;
  per_series: Record<string, number>;
}

export interface Alert {
  level: "critical" | "warning" | "info";
  code: string;
  message: string;
  value?: number | null;
  threshold?: number | null;
}

export interface ScenarioInput {
  label: string;
  revenue_growth_pct: number;
  cost_multiplier: number;
  one_off_amount: number;
  one_off_direction: Direction;
  one_off_week: number;
}

export interface ScenarioResult {
  label: string;
  series: SeriesForecast[];
  projected_balance_p50: number;
  runway_weeks: number | null;
  delta_projected_balance: number;
  delta_net_total: number;
}

export interface Thresholds {
  min_balance?: number | null;
  min_runway_weeks?: number | null;
}

export interface Recommendation {
  kind: "cut" | "afford" | "info";
  message: string;
  value?: number | null;
}

export interface RunwayInsight {
  runway_weeks: number | null;
  runway_months: number | null;
  runway_date: string | null;
  solvent: boolean;
  recommendations: Recommendation[];
}

export interface ForecastResponse {
  generated_at: string;
  as_of: string;
  horizon_weeks: number;
  currency: string;
  opening_balance: number;
  runway_weeks: number | null;
  projected_balance_p50: number;
  series: SeriesForecast[];
  narrative: Narrative;
  cached: boolean;
  categories: CategoryFlow[];
  drivers: Driver[];
  calibration: IntervalCalibration | null;
  alerts: Alert[];
  scenario: ScenarioResult | null;
  insight: RunwayInsight | null;
}

export interface RunSummary {
  id: string;
  created_at: string;
  source: string;
  currency: string;
  horizon_weeks: number;
  opening_balance: number;
  projected_balance_p50: number;
  runway_weeks: number | null;
  label: string;
}

export interface FxRates {
  base: string;
  rates: Record<string, number>;
  as_of: string;
}

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "");

if (!RAW_API_BASE && process.env.NODE_ENV === "production") {
  // Fail loud: a production build without an API base is a deploy misconfiguration.
  // eslint-disable-next-line no-console
  console.error(
    "[config] NEXT_PUBLIC_API_BASE is not set. API calls will fail. " +
      "Set it to your backend URL in the hosting environment and redeploy.",
  );
}

/** Absolute backend origin. Shared so every caller stays in sync (no duplication). */
export const API_BASE = RAW_API_BASE ?? "http://localhost:8000";

export class ApiError extends Error {}

/* ---------------------------------------------------------------------------
 * Auth: token storage + Bearer header helpers.
 * The token lives in localStorage so a reload keeps the session. A tiny
 * subscriber list lets React components react to login/logout.
 * ------------------------------------------------------------------------- */

export interface UserPublic {
  id: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserPublic;
}

const TOKEN_KEY = "cff.token";
const authListeners = new Set<() => void>();

/** Subscribe to auth-token changes (login/logout). Returns an unsubscribe fn. */
export function onAuthChange(cb: () => void): () => void {
  authListeners.add(cb);
  return () => authListeners.delete(cb);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  authListeners.forEach((cb) => cb());
}

/** Bearer header for the current token, or an empty object when signed out. */
function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

async function handleToken(res: Response): Promise<TokenResponse> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body; keep default */
    }
    throw new ApiError(detail);
  }
  return (await res.json()) as TokenResponse;
}

export async function register(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await handleToken(res);
  setToken(body.access_token);
  return body;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await handleToken(res);
  setToken(body.access_token);
  return body;
}

export function logout(): void {
  setToken(null);
}

/** Fetch the signed-in user, or null when the token is missing/expired. */
export async function fetchMe(): Promise<UserPublic | null> {
  if (!getToken()) return null;
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
  if (res.status === 401) {
    setToken(null);
    return null;
  }
  if (!res.ok) throw new ApiError(`Could not load account (${res.status})`);
  return (await res.json()) as UserPublic;
}

async function handle(res: Response): Promise<ForecastResponse> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body; keep default */
    }
    throw new ApiError(detail);
  }
  return (await res.json()) as ForecastResponse;
}

export interface DemoParams {
  weeks: number;
  seed: number;
  starting_mrr: number;
  opening_balance: number;
  currency: string;
  thresholds?: Thresholds | null;
  scenario?: ScenarioInput | null;
}

export async function fetchDemoForecast(params: DemoParams): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/api/forecast/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(params),
  });
  return handle(res);
}

export interface ProgressEvent {
  fraction: number;
  message: string;
}

/**
 * Streaming demo forecast over Server-Sent Events. Calls onProgress as stages
 * complete, resolves with the final forecast. Thresholds are sent as query
 * params; scenario is applied client-side via a follow-up (it is instant).
 */
export function streamDemoForecast(
  params: DemoParams,
  onProgress: (p: ProgressEvent) => void,
  signal?: AbortSignal,
): Promise<ForecastResponse> {
  const url = new URL(`${API_BASE}/api/forecast/demo/stream`);
  url.searchParams.set("weeks", String(params.weeks));
  url.searchParams.set("seed", String(params.seed));
  url.searchParams.set("starting_mrr", String(params.starting_mrr));
  url.searchParams.set("opening_balance", String(params.opening_balance));
  url.searchParams.set("currency", params.currency);
  if (params.thresholds?.min_balance != null)
    url.searchParams.set("min_balance", String(params.thresholds.min_balance));
  if (params.thresholds?.min_runway_weeks != null)
    url.searchParams.set("min_runway_weeks", String(params.thresholds.min_runway_weeks));

  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const res = await fetch(url.toString(), {
          headers: { Accept: "text/event-stream", ...authHeaders() },
          signal,
        });
        if (!res.ok || !res.body) {
          reject(new ApiError(`Stream failed (${res.status})`));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let result: ForecastResponse | null = null;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const evMatch = frame.match(/^event: (.+)$/m);
            const dataMatch = frame.match(/^data: (.+)$/m);
            if (!evMatch || !dataMatch) continue;
            const ev = evMatch[1].trim();
            const data = JSON.parse(dataMatch[1]);
            if (ev === "progress") onProgress(data as ProgressEvent);
            else if (ev === "result") result = data as ForecastResponse;
            else if (ev === "error") reject(new ApiError(data.detail ?? "Stream error"));
          }
        }
        if (result) resolve(result);
        else reject(new ApiError("Stream ended without a result."));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        reject(e instanceof ApiError ? e : new ApiError("Stream connection failed."));
      }
    })();
  });
}

export async function uploadForecast(
  file: File,
  openingBalance: number,
): Promise<ForecastResponse> {
  const form = new FormData();
  form.append("file", file);
  const url = new URL(`${API_BASE}/api/forecast/upload`);
  url.searchParams.set("opening_balance", String(openingBalance));
  const res = await fetch(url.toString(), { method: "POST", body: form, headers: authHeaders() });
  return handle(res);
}

export async function fetchRuns(limit = 25): Promise<RunSummary[]> {
  const res = await fetch(`${API_BASE}/api/runs?limit=${limit}`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(`Could not load run history (${res.status})`);
  return (await res.json()) as RunSummary[];
}

export async function fetchRun(id: string): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/api/runs/${id}`, { headers: authHeaders() });
  return handle(res);
}

export async function clearRuns(): Promise<number> {
  const res = await fetch(`${API_BASE}/api/runs`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new ApiError(`Could not clear run history (${res.status})`);
  const body = (await res.json()) as { deleted: number };
  return body.deleted;
}

/**
 * Download a run's CSV. Uses fetch (not a plain link) so the Bearer token is
 * sent — user-scoped runs 404 on an unauthenticated request.
 */
export async function downloadRunCsv(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/runs/${id}/export.csv`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(`Could not export run (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `forecast_${id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export async function fetchFxRates(): Promise<FxRates> {
  const res = await fetch(`${API_BASE}/api/fx`);
  if (!res.ok) throw new ApiError(`Could not load FX rates (${res.status})`);
  return (await res.json()) as FxRates;
}

/* ---- Saved scenarios (auth required) ------------------------------------- */

export interface SavedScenario {
  id: string;
  name: string;
  scenario: ScenarioInput;
  created_at: string;
}

export async function listScenarios(): Promise<SavedScenario[]> {
  if (!getToken()) return [];
  const res = await fetch(`${API_BASE}/api/scenarios`, { headers: authHeaders() });
  if (res.status === 401) return [];
  if (!res.ok) throw new ApiError(`Could not load saved scenarios (${res.status})`);
  return (await res.json()) as SavedScenario[];
}

export async function saveScenario(name: string, scenario: ScenarioInput): Promise<SavedScenario> {
  const res = await fetch(`${API_BASE}/api/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, scenario }),
  });
  if (!res.ok) {
    let detail = `Could not save scenario (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* keep default */
    }
    throw new ApiError(detail);
  }
  return (await res.json()) as SavedScenario;
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/scenarios/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new ApiError(`Could not delete scenario (${res.status})`);
}
