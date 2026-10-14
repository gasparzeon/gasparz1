// Utilitários do painel que rodam no navegador.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get code() {
    return typeof this.data?.error === 'string' ? this.data.error : undefined;
  }
}

const ACCESS_TOKEN_TTL = 15 * 60;

let sessionExpiry = 0;
let inflight: Promise<RefreshResult> | null = null;

export type RefreshResult = { ok: true } | { ok: false; reason: 'expired' | 'network' };

export function setSessionExpiry(expiresAt: number) {
  sessionExpiry = expiresAt;
}

export function getSessionExpiry() {
  return sessionExpiry;
}

async function doRefresh(): Promise<RefreshResult> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (response.ok) {
      const data = (await response.json()) as { expiresAt?: number };
      sessionExpiry = data.expiresAt ?? Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL;
      return { ok: true };
    }

    // Outra aba renovou ao mesmo tempo; os cookies novos já estão no navegador.
    if (response.status === 409) {
      sessionExpiry = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL - 60;
      return { ok: true };
    }

    return { ok: false, reason: 'expired' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

// Single-flight por aba e serializado entre abas (Web Locks), para que
// duas abas não troquem o mesmo refresh token ao mesmo tempo.
export function refreshSession(): Promise<RefreshResult> {
  if (!inflight) {
    const run = () => doRefresh();
    inflight = (
      typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request('gaspar-admin-refresh', run)
        : run()
    ).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function redirectToLogin() {
  const returnTo = window.location.pathname + window.location.search;
  window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}

async function parse(response: Response) {
  if (response.status === 204) return null;
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

export async function adminFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const send = () =>
    fetch(url, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });

  let response: Response;
  try {
    response = await send();
    if (response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed.ok) {
        if (refreshed.reason === 'expired') redirectToLogin();
        throw new ApiError('Sua sessão expirou. Entre novamente.', 401);
      }
      response = await send();
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Sem conexão com o servidor.', 0);
  }

  const data = await parse(response);
  if (!response.ok) {
    throw new ApiError(
      typeof data?.message === 'string' ? data.message : `Erro ${response.status}`,
      response.status,
      data,
    );
  }

  return data as T;
}
