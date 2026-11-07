import { rm } from './request-manager';
import type { User } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const KEY  = 'services.tokens';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: unknown[] = []) {
    super(message);
  }
  /** Human text, including per-field validation messages. */
  get friendly(): string {
    const d = this.details as { field?: string; messages?: string[] }[];
    if (this.code === 'VALIDATION_ERROR' && d.length) return d.map((x) => `${x.field}: ${x.messages?.join(', ')}`).join(' · ');
    return this.message;
  }
}

interface Tokens { accessToken: string; refreshToken: string }
export const tokens = {
  get(): Tokens | null {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
  },
  set(t: Tokens | null) {
    if (typeof window === 'undefined') return;
    if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY);
  },
};

let refreshing: Promise<boolean> | null = null;
/** One refresh at a time: the API revokes the whole token family if a rotated token is replayed. */
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const t = tokens.get();
    if (!t) return false;
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: t.refreshToken }),
    });
    if (!res.ok) { tokens.set(null); return false; }
    const { data } = await res.json();
    tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

/** Build a fetch call and return a Response. Shared between first attempt and token-refresh retry. */
function buildFetch(path: string, init: ApiInit, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = {};
  const t = tokens.get();
  if (t && init.auth !== false) headers.Authorization = `Bearer ${t.accessToken}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}${path}`, {
    method : init.method ?? (init.body !== undefined || init.form ? 'POST' : 'GET'),
    headers,
    body   : init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    signal,
  });
}

type ApiInit = { method?: string; body?: unknown; form?: FormData; auth?: boolean };
type ApiResponse<T> = { data: T; meta?: { page: number; total: number; totalPages: number } };

/**
 * Core API fetch with:
 *  • Automatic bearer-token injection + single-flight token refresh on 401
 *  • GET deduplication via RequestManager (concurrent identical GETs share one Promise)
 *  • Mutation double-submit prevention via RequestManager
 *  • Circuit breaker — after 3 consecutive failures the endpoint is locked for 30 s
 *
 * The `signal` parameter is used by managed poll loops (BookingChat, NotificationsMenu)
 * so the RequestManager can cancel an in-flight request when a new poll tick fires.
 */
export async function api<T>(
  path: string,
  init: ApiInit = {},
  signal?: AbortSignal,
): Promise<ApiResponse<T>> {
  const method = (init.method ?? (init.body !== undefined || init.form ? 'POST' : 'GET')).toUpperCase();
  const isRead  = method === 'GET' || method === 'HEAD';

  // Shared core: performs the actual fetch + handles 401 refresh
  async function execute(): Promise<ApiResponse<T>> {
    let res: Response;
    try {
      res = await buildFetch(path, init, signal);
    } catch (e) {
      // Propagate AbortError as-is so the RequestManager can distinguish it
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check that the API is running.');
    }

    // Transparent token refresh on 401
    if (res.status === 401 && init.auth !== false && tokens.get() && (await refresh())) {
      try {
        res = await buildFetch(path, init, signal);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check that the API is running.');
      }
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = json?.error ?? {};
      throw new ApiError(res.status, e.code ?? 'UNKNOWN', e.message ?? 'Something went wrong.', e.details ?? []);
    }
    return json as ApiResponse<T>;
  }

  if (isRead) {
    // GET: deduplicated + circuit-broken
    const result = await rm.get<ApiResponse<T>>(
      `${method}:${path}`,
      execute,
      { circuitKey: path },
    );
    // rm.get() returns null when skipped (hidden tab / open circuit)
    if (result === null) {
      // Return a stable empty payload so callers don't need null checks
      return { data: null as unknown as T };
    }
    return result;
  } else {
    // Mutation: double-submit guard + circuit breaker (no dedup — mutations are intentional)
    const mutationKey = `${method}:${path}`;
    const result = await rm.mutate<ApiResponse<T>>(
      mutationKey,
      execute,
      { circuitKey: path },
    );
    if (result === null) {
      // Dropped duplicate — throw so callers know not to proceed
      throw new ApiError(409, 'DUPLICATE_REQUEST', 'A request is already in progress. Please wait.');
    }
    return result;
  }
}

export async function loginRequest(path: 'login' | 'register', body: unknown) {
  const { data } = await api<{ user: User; accessToken: string; refreshToken: string }>(`/auth/${path}`, { body, auth: false });
  tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.user;
}

export const pkr  = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;
export const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
