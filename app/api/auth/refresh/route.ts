import { NextResponse, type NextRequest } from 'next/server';

import { COOKIES } from '@/lib/auth/config';
import { OAuthError, RefreshRaceError, refreshTokens } from '@/lib/auth/oauth';
import {
  clearSessionCookies,
  getRequestOrigin,
  isSameOriginRequest,
  noStore,
  sanitizeReturnTo,
  setSessionCookies,
} from '@/lib/auth/session';

// GET: usado pelo proxy em navegações com access token expirado.
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request.headers);
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'));

  const toLogin = () => {
    const url = new URL('/api/auth/login', origin);
    url.searchParams.set('returnTo', returnTo);
    return url;
  };

  const refreshToken = request.cookies.get(COOKIES.refresh)?.value;
  if (!refreshToken) {
    return noStore(NextResponse.redirect(toLogin(), 303));
  }

  try {
    const tokens = await refreshTokens(refreshToken);
    const response = NextResponse.redirect(new URL(returnTo, origin), 303);
    setSessionCookies(response, tokens);
    return noStore(response);
  } catch (error) {
    if (!(error instanceof OAuthError)) throw error;

    const response = NextResponse.redirect(toLogin(), 303);
    // Em corrida entre abas a outra requisição já gravou cookies novos;
    // apagá-los derrubaria a sessão válida.
    if (!(error instanceof RefreshRaceError)) clearSessionCookies(response);
    return noStore(response);
  }
}

// POST: renovação silenciosa feita pelo painel enquanto está aberto.
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return noStore(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
  }

  const refreshToken = request.cookies.get(COOKIES.refresh)?.value;
  if (!refreshToken) {
    return noStore(NextResponse.json({ error: 'unauthorized' }, { status: 401 }));
  }

  try {
    const tokens = await refreshTokens(refreshToken);
    const response = NextResponse.json({ expiresAt: tokens.accessTokenExpiresAt });
    setSessionCookies(response, tokens);
    return noStore(response);
  } catch (error) {
    if (error instanceof RefreshRaceError) {
      return noStore(NextResponse.json({ error: 'concurrent' }, { status: 409 }));
    }
    if (error instanceof OAuthError) {
      const response = NextResponse.json(
        { error: error.error, message: error.description },
        { status: 401 },
      );
      clearSessionCookies(response);
      return noStore(response);
    }
    throw error;
  }
}
