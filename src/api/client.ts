import { auth } from '../firebase';

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '');

/**
 * API base URL. Prefer an explicit VITE_API_BASE_URL; otherwise derive it from
 * the Telegram auth endpoint (same host) by stripping the `/auth/telegram` suffix.
 */
const API_BASE = stripTrailingSlash(
  import.meta.env.VITE_API_BASE_URL?.trim() ||
    (import.meta.env.VITE_TELEGRAM_AUTH_API_URL?.trim() || '').replace(/\/auth\/telegram\/?$/, ''),
);

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    // Skip the ngrok free-tier interstitial so responses stay JSON in dev tunnels.
    'ngrok-skip-browser-warning': 'true',
    ...(await authHeaders()),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText, err.details);
  }
  return data as T;
}

export const api = {
  baseUrl: API_BASE,
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T = void>(path: string) => request<T>('DELETE', path),
};
