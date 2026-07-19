/* =============================================================
   ckey.vn API client
   Calls go through the Vite dev proxy (/api/ckey/*), which injects
   the auth cookie server-side. See vite.config.ts.
   ============================================================= */

// ---- Endpoint: /ajax/apiai-stream ----

export interface StreamTotals {
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens: number;
  charged_text: string;
  input_cost_text: string;
  output_cost_text: string;
  success_rate: number;
}

export interface LogEntry {
  id: number;
  created_at: number;
  created_at_text: string;
  model_name: string;
  request_path: string;
  stream: boolean;
  status: string;
  http_status: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens: number;
  charged_vnd: number;
  charged_text: string;
  input_cost_text: string;
  output_cost_text: string;
  cache_read_cost_text: string;
  cache_write_cost_text: string;
  latency_ms: number;
  error: string;
}

export interface StreamResponse {
  ok: boolean;
  ts: number;
  health: { online: boolean; status: number; latency_ms: number };
  balance: { vnd: number; text: string };
  hold: { count: number; vnd: number; text: string };
  totals: StreamTotals;
  today: StreamTotals;
  success_rate: number;
  limits: {
    limits: {
      username: string;
      daily_limit_vnd: number;
      weekly_limit_vnd: number;
      monthly_limit_vnd: number;
      total_limit_vnd: number;
      enabled: number;
      alert_threshold_percent: number;
      hard_block_enabled: number;
    };
    spend: {
      daily_spent_vnd: number;
      weekly_spent_vnd: number;
      monthly_spent_vnd: number;
      total_spent_vnd: number;
      pending_vnd: number;
    };
    text: Record<string, string>;
  };
  logs: LogEntry[];
}

// ---- Endpoint: /ajax/apiai-usage-breakdown ----

export interface ModelBreakdown {
  model_name: string;
  total_requests: number;
  success_requests: number;
  failed_requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_read_tokens: number;
  charged_vnd: number;
  charged_text: string;
  success_rate: number;
}

export interface TrendPoint {
  label: string;
  requests: number;
  tokens: number;
  charged_vnd: number;
  charged_display: number;
  charged_text: string;
}

export interface BreakdownResponse {
  ok: boolean;
  ts: number;
  range: string;
  currency_symbol: string;
  models: ModelBreakdown[];
  trend: TrendPoint[];
}

export type RangeKey = '7d' | '30d' | '90d';

// ---- Fetch helpers ----

const BASE = '/api/ckey';
const KEY_STORAGE = 'ckey_admin_key';

/** Thrown when the proxy rejects the admin key (HTTP 401). */
export class UnauthorizedError extends Error {
  constructor(message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// ---- Admin key (kept in sessionStorage, cleared on logout / tab close) ----

export function getAdminKey(): string {
  try {
    return sessionStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setAdminKey(key: string): void {
  try {
    sessionStorage.setItem(KEY_STORAGE, key);
  } catch {
    /* ignore storage errors */
  }
}

export function clearAdminKey(): void {
  try {
    sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function isAuthenticated(): boolean {
  return getAdminKey().length > 0;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: 'application/json', 'x-admin-key': getAdminKey() },
  });

  if (res.status === 401) {
    clearAdminKey();
    throw new UnauthorizedError();
  }

  // The proxy returns ckey.vn's response; a login redirect or error page comes
  // back as HTML, so guard on content-type before parsing.
  const ct = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    // Proxy errors are JSON with an `error` field; surface it if present.
    let detail = '';
    if (ct.includes('application/json')) {
      detail = await res
        .json()
        .then((b: { error?: string }) => b.error ?? '')
        .catch(() => '');
    }
    throw new Error(detail || `Máy chủ trả về HTTP ${res.status}.`);
  }
  if (!ct.includes('application/json')) {
    throw new Error('Phản hồi không phải JSON — cookie ckey.vn có thể đã hết hạn.');
  }
  return res.json() as Promise<T>;
}

/**
 * Verify a candidate password by making a real (cheap) proxied request with it.
 * On success the key is stored; on 401 an UnauthorizedError is thrown.
 */
export async function verifyAdminKey(candidate: string): Promise<void> {
  const res = await fetch(`${BASE}/apiai-stream?logs_limit=1`, {
    headers: { accept: 'application/json', 'x-admin-key': candidate },
  });
  if (res.status === 401) {
    throw new UnauthorizedError('Mật khẩu không đúng.');
  }
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { error?: string }) => b.error ?? '')
      .catch(() => '');
    throw new Error(detail || `Máy chủ trả về HTTP ${res.status}.`);
  }
  setAdminKey(candidate);
}

export function fetchStream(logsLimit = 8): Promise<StreamResponse> {
  return getJSON<StreamResponse>(`/apiai-stream?logs_limit=${logsLimit}`);
}

export function fetchBreakdown(range: RangeKey): Promise<BreakdownResponse> {
  return getJSON<BreakdownResponse>(`/apiai-usage-breakdown?range=${range}`);
}

// ---- Formatting ----

/** Format a VND amount like ckey.vn does: thousands separated by dots. */
export function formatVND(vnd: number): string {
  return `${Math.round(vnd).toLocaleString('vi-VN')} VND`;
}

/** Compact large token counts: 47,639,300 -> 47.6M */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/** Strip the "owner/" prefix from a model name for display. */
export function shortModelName(modelName: string): string {
  const slash = modelName.indexOf('/');
  return slash >= 0 ? modelName.slice(slash + 1) : modelName;
}
