/* =============================================================
   ckey.vn API client (REST API version using CKEY_APIKEY)
   Calls go through the Vite dev proxy (/api/ckey/*), which injects
   the key parameter server-side. See vite.config.ts.
   ============================================================= */

// ---- Data Models based on ckey.vn API Documents ----

export interface UserProfile {
  username: string;
  name: string;
  email: string;
  balance: string;
  balance_raw: number;
  created_at: string;
  created_at_timestamp: number;
  api_key_masked: string;
}

export interface ProfileResponse {
  success: boolean;
  status: number;
  message: string;
  data: {
    profile: UserProfile;
  };
}

export interface LLMUsageStats {
  requests: number;
  success_requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  charged_vnd: number;
  charged_vnd_text: string;
  since: number;
}

export interface LLMUsageStatsResponse {
  success: boolean;
  status: number;
  message: string;
  data: LLMUsageStats;
}

export interface LLMModel {
  public_name: string;
  display_name: string;
  model_name: string;
  provider_username: string;
  is_provider_model: boolean;
  input_price_per_million_vnd: number;
  output_price_per_million_vnd: number;
  price_per_request_vnd: number;
  min_charge_per_request_vnd: number;
  cache_enabled: boolean;
  cache_read_price_per_million_vnd: number;
  cache_write_price_per_million_vnd: number;
  request_rate_limit_per_minute: number;
  max_output_tokens_limit: number;
  context_tokens_limit: number;
  supported_paths: string[];
}

export interface LLMModelsResponse {
  success: boolean;
  status: number;
  message: string;
  data: {
    count: number;
    models: LLMModel[];
  };
}

export interface LLMUsageItem {
  request_id: string;
  model_name: string;
  request_path: string;
  http_status: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  charged_vnd: number;
  status: string;
  latency_ms: number;
  stream: boolean;
  created_at: number;
  created_at_text: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface LLMUsageResponse {
  success: boolean;
  status: number;
  message: string;
  data: {
    items: LLMUsageItem[];
    pagination: Pagination;
  };
}

export interface LLMKeyItem {
  id: number;
  key_name: string;
  api_key: string;
  key_prefix: string;
  is_active: boolean;
  created_at: number;
  created_at_text: string;
}

export interface LLMKeysResponse {
  success: boolean;
  status: number;
  message: string;
  data: {
    items: LLMKeyItem[];
  };
}

export interface BankInfo {
  id: number;
  bank_name: string;
  account_owner: string;
  account_number: string;
  transfer_content: string;
  qr_url: string;
}

export interface DepositInfoResponse {
  success: boolean;
  status: number;
  message: string;
  data: {
    transfer_content: string;
    banks: BankInfo[];
  };
}

export interface DepositItem {
  id: number;
  amount: number;
  amount_text: string;
  time: number;
  time_text: string;
}

export interface DepositCheckResponse {
  success: boolean;
  status: number;
  message: string;
  data: {
    has_new_deposit: boolean;
    count: number;
    total_amount: number;
    total_amount_text: string;
    latest?: DepositItem;
    items: DepositItem[];
    filter: {
      minutes: number;
      limit: number;
    };
  };
}

export interface DepositHistoryResponse {
  success: boolean;
  status: number;
  message: string;
  data: {
    items: DepositItem[];
    pagination: Pagination;
  };
}

// ---- Fetch helpers & Admin Key storage ----

const CKEY_BASE_URL = (import.meta.env.VITE_CKEY_BASE_URL as string | undefined) || '/api/ckey';
const KEY_STORAGE = 'ckey_admin_key';

export function getApiKey(): string {
  return (import.meta.env.VITE_CKEY_APIKEY as string | undefined) || '';
}

function buildTargetUrl(path: string): string {
  if (CKEY_BASE_URL.startsWith('http')) {
    const apiKey = getApiKey();
    const sep = path.includes('?') ? '&' : '?';
    return `${CKEY_BASE_URL}${path}${apiKey ? `${sep}key=${encodeURIComponent(apiKey)}` : ''}`;
  }
  return `${CKEY_BASE_URL}${path}`;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Invalid or expired session. Please sign in again.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

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
  const res = await fetch(buildTargetUrl(path), {
    headers: { accept: 'application/json', 'x-admin-key': getAdminKey() },
  });

  if (res.status === 401) {
    clearAdminKey();
    throw new UnauthorizedError();
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    let detail = '';
    if (ct.includes('application/json')) {
      detail = await res
        .json()
        .then((b: { error?: string; message?: string }) => b.message || b.error || '')
        .catch(() => '');
    }
    throw new Error(detail || `Server returned HTTP ${res.status}.`);
  }
  if (!ct.includes('application/json')) {
    throw new Error('Response is not valid JSON from ckey.vn API.');
  }
  return res.json() as Promise<T>;
}

export async function verifyAdminKey(candidate: string): Promise<void> {
  const res = await fetch(buildTargetUrl('/profile'), {
    headers: { accept: 'application/json', 'x-admin-key': candidate },
  });
  if (res.status === 401) {
    throw new UnauthorizedError('Incorrect password.');
  }
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { error?: string; message?: string }) => b.message || b.error || '')
      .catch(() => '');
    throw new Error(detail || `Server returned HTTP ${res.status}.`);
  }
  setAdminKey(candidate);
}

// ---- API Service Calls ----

export function fetchProfile(): Promise<ProfileResponse> {
  return getJSON<ProfileResponse>('/profile');
}

export function fetchLLMUsageStats(): Promise<LLMUsageStatsResponse> {
  return getJSON<LLMUsageStatsResponse>('/llm/usage-stats');
}

export function fetchLLMModels(): Promise<LLMModelsResponse> {
  return getJSON<LLMModelsResponse>('/llm/models');
}

export function fetchLLMUsage(page = 1, limit = 20): Promise<LLMUsageResponse> {
  return getJSON<LLMUsageResponse>(`/llm/usage?page=${page}&limit=${limit}`);
}

export function fetchLLMKeys(): Promise<LLMKeysResponse> {
  return getJSON<LLMKeysResponse>('/llm/keys');
}

export function fetchDepositInfo(): Promise<DepositInfoResponse> {
  return getJSON<DepositInfoResponse>('/deposit-info');
}

export function fetchDepositCheck(minutes = 1440, limit = 20): Promise<DepositCheckResponse> {
  return getJSON<DepositCheckResponse>(`/deposit-check?minutes=${minutes}&limit=${limit}`);
}

export function fetchDepositHistory(page = 1, limit = 20): Promise<DepositHistoryResponse> {
  return getJSON<DepositHistoryResponse>(`/deposit-history?page=${page}&limit=${limit}`);
}

// ---- Formatting Helpers ----

export function formatVND(vnd: number): string {
  return `${Math.round(vnd).toLocaleString('en-US')} VND`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export interface ModelDisplay {
  provider: string | null;
  name: string;
}

export function formatModelName(modelName: string): ModelDisplay {
  const slash = modelName.indexOf('/');
  const provider = slash >= 0 ? modelName.slice(0, slash) : null;
  const rawModel = slash >= 0 ? modelName.slice(slash + 1) : modelName;
  return { provider, name: rawModel };
}
