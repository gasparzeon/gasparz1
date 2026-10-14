import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextResponse } from 'next/server';

import { COOKIES, LOGIN_TX_TTL, isProduction } from './config';
import { isSessionRevoked, type TokenSet } from './oauth';
import type { Actor, Role } from './permissions';
import { verifyAccessToken } from './tokens';
import { getSessionUser } from '@/lib/users/service';

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
  avatarUrl: string;
};

export type AdminSession = {
  user: SessionUser;
  sid: string;
  scope: string;
  expiresAt: number;
};

export const actorOf = (session: AdminSession): Actor => ({
  id: session.user.id,
  role: session.user.role,
});

type CookieOptions = Parameters<NextResponse['cookies']['set']>[2];

function baseCookie(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge,
  };
}

export function setSessionCookies(response: NextResponse, tokens: TokenSet) {
  const now = Math.floor(Date.now() / 1000);

  response.cookies.set(
    COOKIES.access,
    tokens.accessToken,
    baseCookie(tokens.accessTokenExpiresAt - now),
  );

  // O refresh token só trafega para /api/auth (refresh e logout).
  response.cookies.set(COOKIES.refresh, tokens.refreshToken, {
    ...baseCookie(tokens.refreshTokenExpiresAt - now),
    path: '/api/auth',
  });

  // Dica legível pelo JavaScript só para o cabeçalho do site trocar "Entrar"
  // por "Painel". Não carrega dado nenhum e não autoriza nada: quem decide
  // continua sendo o access token httpOnly.
  response.cookies.set(COOKIES.hint, '1', {
    ...baseCookie(tokens.refreshTokenExpiresAt - now),
    httpOnly: false,
    sameSite: 'lax',
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(COOKIES.access, '', baseCookie(0));
  response.cookies.set(COOKIES.refresh, '', {
    ...baseCookie(0),
    path: '/api/auth',
  });
  response.cookies.set(COOKIES.hint, '', { ...baseCookie(0), httpOnly: false, sameSite: 'lax' });
}

export function setLoginTxCookie(response: NextResponse, value: string) {
  // Lax: o callback precisa receber o cookie após o redirect do login.
  response.cookies.set(COOKIES.tx, value, {
    ...baseCookie(LOGIN_TX_TTL),
    sameSite: 'lax',
    path: '/api/auth',
  });
}

export function clearLoginTxCookie(response: NextResponse) {
  response.cookies.set(COOKIES.tx, '', {
    ...baseCookie(0),
    sameSite: 'lax',
    path: '/api/auth',
  });
}

export function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export function getRequestOrigin(h: Headers) {
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto =
    h.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? (isProduction ? 'https' : 'http');
  return `${proto}://${host}`;
}

export function getClientIp(h: Headers) {
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

// Aceita só caminhos internos do site para evitar open redirect: o painel
// inteiro e, para o fluxo de comentários, a home e os posts.
export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/admin';
  }

  try {
    const url = new URL(value, 'http://internal.invalid');
    if (url.origin !== 'http://internal.invalid') return '/admin';
    if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')) {
      if (url.pathname === '/' || url.pathname === '/posts' || url.pathname.startsWith('/posts/')) {
        return url.pathname + url.search;
      }
      return '/admin';
    }
    if (url.pathname.startsWith('/admin/login')) return '/admin';
    return url.pathname + url.search;
  } catch {
    return '/admin';
  }
}

// JWT válido não basta: a sessão não pode ter sido revogada e o usuário
// precisa continuar ativo (papel e status são lidos do banco a cada vez).
async function sessionFromToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;
  if (await isSessionRevoked(claims.sid)) return null;

  const user = await getSessionUser(claims.sub);
  if (!user || user.status !== 'active') return null;
  if (claims.iat < Math.floor(user.sessionsValidAfter.getTime() / 1000)) return null;

  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
    sid: claims.sid,
    scope: claims.scope,
    expiresAt: claims.exp,
  };
}

// Para Server Components (memoizado por requisição).
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const store = await cookies();
  return sessionFromToken(store.get(COOKIES.access)?.value);
});

export async function requireAdminPage(returnTo = '/admin') {
  const session = await getAdminSession();
  if (!session) {
    redirect(`/api/auth/refresh?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

function bearerToken(h: Headers) {
  const match = h.get('authorization')?.match(/^Bearer\s+([\w.~+/=-]+)$/i);
  return match?.[1];
}

// Para Route Handlers: aceita Bearer (RFC 6750) ou o cookie do painel.
export async function authenticateRequest(request: Request) {
  const bearer = bearerToken(request.headers);
  if (bearer) {
    return { session: await sessionFromToken(bearer), viaCookie: false };
  }

  const store = await cookies();
  return {
    session: await sessionFromToken(store.get(COOKIES.access)?.value),
    viaCookie: true,
  };
}

// Defesa contra CSRF em requisições autenticadas por cookie, além do
// SameSite=Strict: a origem precisa ser o próprio site.
export function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;

  const origin = request.headers.get('origin');
  if (!origin) return fetchSite === 'same-origin';

  return origin === getRequestOrigin(request.headers);
}

export async function getServerOrigin() {
  return getRequestOrigin(await headers());
}
