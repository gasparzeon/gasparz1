import { NextResponse, type NextRequest } from 'next/server';

import {
  ADMIN_CLIENT_ID,
  ADMIN_SCOPE,
  AUTHORIZE_PATH,
  AuthConfigError,
  LOGIN_TX_TTL,
} from '@/lib/auth/config';
import { pkceChallenge, randomToken } from '@/lib/auth/crypto';
import { callbackUrl } from '@/lib/auth/oauth';
import { getRequestOrigin, noStore, sanitizeReturnTo, setLoginTxCookie } from '@/lib/auth/session';
import { seal } from '@/lib/auth/tokens';

// Lado cliente (BFF) do fluxo: gera state + PKCE, guarda numa transação
// cifrada em cookie httpOnly e redireciona para o endpoint de autorização.
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request.headers);
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'));

  const state = randomToken(24);
  const codeVerifier = randomToken(48);

  let tx: string;
  try {
    tx = await seal(
      'tx',
      { state, verifier: codeVerifier, returnTo },
      Math.floor(Date.now() / 1000) + LOGIN_TX_TTL,
    );
  } catch (error) {
    if (error instanceof AuthConfigError) {
      return noStore(NextResponse.redirect(new URL(`${AUTHORIZE_PATH}?error=config`, origin), 303));
    }
    throw error;
  }

  const authorize = new URL(AUTHORIZE_PATH, origin);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', ADMIN_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', callbackUrl(origin));
  authorize.searchParams.set('scope', ADMIN_SCOPE);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', pkceChallenge(codeVerifier));
  authorize.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authorize, 303);
  setLoginTxCookie(response, tx);
  return noStore(response);
}
