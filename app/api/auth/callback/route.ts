import { NextResponse, type NextRequest } from 'next/server';

import { ADMIN_CLIENT_ID, AUTHORIZE_PATH, COOKIES } from '@/lib/auth/config';
import { safeEqual } from '@/lib/auth/crypto';
import { OAuthError, callbackUrl, exchangeAuthorizationCode } from '@/lib/auth/oauth';
import {
  clearLoginTxCookie,
  getRequestOrigin,
  noStore,
  sanitizeReturnTo,
  setSessionCookies,
} from '@/lib/auth/session';
import { unseal } from '@/lib/auth/tokens';

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request.headers);
  const params = request.nextUrl.searchParams;

  const fail = (reason: string) => {
    const url = new URL(AUTHORIZE_PATH, origin);
    url.searchParams.set('error', reason);
    const response = NextResponse.redirect(url, 303);
    clearLoginTxCookie(response);
    return noStore(response);
  };

  const rawTx = request.cookies.get(COOKIES.tx)?.value;
  const tx = rawTx
    ? await unseal<{ state: string; verifier: string; returnTo: string }>('tx', rawTx)
    : null;

  const state = params.get('state');
  if (!tx || !state || !safeEqual(state, tx.state)) {
    return fail('state');
  }

  if (params.get('error')) {
    return fail(params.get('error') === 'access_denied' ? 'denied' : 'authorize');
  }

  const code = params.get('code');
  if (!code) return fail('authorize');

  try {
    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: tx.verifier,
      clientId: ADMIN_CLIENT_ID,
      redirectUri: callbackUrl(origin),
    });

    const response = NextResponse.redirect(new URL(sanitizeReturnTo(tx.returnTo), origin), 303);
    setSessionCookies(response, tokens);
    clearLoginTxCookie(response);
    return noStore(response);
  } catch (error) {
    if (error instanceof OAuthError) {
      console.warn('[auth] callback rejeitado:', error.error, error.description);
      return fail('grant');
    }
    throw error;
  }
}
