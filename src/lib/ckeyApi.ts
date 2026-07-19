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

export type RangeKey = 'today' | '7d' | '30d';

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

export interface ModelDisplay {
  /** The provider prefix before "/", kept verbatim (e.g. "thanhnhan9023"), or null. */
  provider: string | null;
  /** The normalized, human-readable model name (e.g. "claude opus 4.8"). */
  name: string;
}

/**
 * Normalize the model portion for display:
 *  - hyphens become spaces:            claude-haiku-4.5  -> claude haiku 4.5
 *  - split version parts rejoin:       ...-4-8...        -> ...4.8...
 *  - trailing variant tags are dropped: claude-opus-4-8-kiro -> claude opus 4.8
 */
function normalizeModelLabel(model: string): string {
  const tokens = model.split('-');

  // Merge adjacent bare-number tokens into a dotted version (4-8 -> 4.8).
  const merged: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (/^\d+$/.test(t) && next !== undefined && /^\d+$/.test(next)) {
      merged.push(`${t}.${next}`);
      i++;
      continue;
    }
    merged.push(t);
  }

  // Drop purely-alphabetic tokens that trail the version number (e.g. "kiro").
  const versionIdx = merged.findIndex((t) => /\d/.test(t));
  const cleaned =
    versionIdx >= 0 ? merged.filter((t, i) => i <= versionIdx || /\d/.test(t)) : merged;

  return cleaned.join(' ');
}

/** Split "owner/model-name" into a kept provider and a normalized model label. */
export function formatModelName(modelName: string): ModelDisplay {
  const slash = modelName.indexOf('/');
  const provider = slash >= 0 ? modelName.slice(0, slash) : null;
  const rawModel = slash >= 0 ? modelName.slice(slash + 1) : modelName;
  return { provider, name: normalizeModelLabel(rawModel) };
}
