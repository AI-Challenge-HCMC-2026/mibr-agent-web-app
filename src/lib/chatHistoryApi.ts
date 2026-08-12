/**
 * Client cho nhóm API "Chat History & Agent Operations".
 *
 * Backend được chạy như một Supabase Edge Function (`chat-api`):
 * GET/POST/DELETE /chat/sessions, /chat/messages, /chat/history
 * Xác thực bằng Supabase JWT (Bearer token).
 */

export const CHAT_HISTORY_API_HOST = 'https://upstbmubljmmuqoslmoj.supabase.co';
export const CHAT_HISTORY_API_BASE = `${CHAT_HISTORY_API_HOST}/functions/v1/chat-api`;
export const CHAT_HISTORY_OPENAPI_URL = '';

export interface ChatSessionDto {
  session_id: string;
  user_id: string;
  title?: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number | null;
}

export interface ChatMessageDto {
  message_id: number;
  session_id: string;
  user_id: string;
  role: string;
  content: string;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface ChatMessageCreatePayload {
  session_id: string;
  user_id?: string | null;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  metadata?: Record<string, any> | null;
  title?: string | null;
}

export interface DeleteResponseDto {
  status: string;
  message: string;
  deleted_count: number;
}

const buildHeaders = (token?: string | null, withBody = false): Record<string, string> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (withBody) headers['Content-Type'] = 'application/json';
  if (token && token.trim()) {
    const clean = token.trim();
    headers.Authorization = clean.startsWith('Bearer ') ? clean : `Bearer ${clean}`;
  }
  return headers;
};

async function request<T>(path: string, init: RequestInit, token?: string | null): Promise<T> {
  const res = await fetch(`${CHAT_HISTORY_API_BASE}${path}`, {
    ...init,
    headers: { ...buildHeaders(token, Boolean(init.body)), ...(init.headers || {}) },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[ChatHistory] ${init.method || 'GET'} ${path} → HTTP ${res.status}: ${detail}`);
  }

  return (await res.json()) as T;
}

export const newSessionId = (): string =>
  `sess_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

export function fetchChatSessions(
  userId: string,
  token?: string | null,
  limit = 50,
  offset = 0
): Promise<ChatSessionDto[]> {
  const query = new URLSearchParams({ user_id: userId, limit: String(limit), offset: String(offset) });
  return request<ChatSessionDto[]>(`/chat/sessions?${query}`, { method: 'GET' }, token);
}

export function fetchSessionMessages(
  sessionId: string,
  userId: string,
  token?: string | null,
  limit = 200
): Promise<ChatMessageDto[]> {
  const query = new URLSearchParams({ user_id: userId, limit: String(limit) });
  return request<ChatMessageDto[]>(
    `/chat/sessions/${encodeURIComponent(sessionId)}/messages?${query}`,
    { method: 'GET' },
    token
  );
}

export function saveChatMessage(
  payload: ChatMessageCreatePayload,
  token?: string | null
): Promise<ChatMessageDto> {
  return request<ChatMessageDto>(
    '/chat/messages',
    { method: 'POST', body: JSON.stringify(payload) },
    token
  );
}

export function deleteChatSession(
  sessionId: string,
  userId: string,
  token?: string | null
): Promise<DeleteResponseDto> {
  const query = new URLSearchParams({ user_id: userId });
  return request<DeleteResponseDto>(
    `/chat/sessions/${encodeURIComponent(sessionId)}?${query}`,
    { method: 'DELETE' },
    token
  );
}

export function deleteAllChatHistory(
  userId: string,
  token?: string | null
): Promise<DeleteResponseDto> {
  const query = new URLSearchParams({ user_id: userId });
  return request<DeleteResponseDto>(`/chat/history?${query}`, { method: 'DELETE' }, token);
}

export function deleteChatMessage(
  messageId: number,
  userId: string,
  token?: string | null
): Promise<DeleteResponseDto> {
  const query = new URLSearchParams({ user_id: userId });
  return request<DeleteResponseDto>(
    `/chat/messages/${messageId}?${query}`,
    { method: 'DELETE' },
    token
  );
}
