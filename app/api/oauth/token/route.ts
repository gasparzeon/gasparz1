import { NextResponse, type NextRequest } from 'next/server';

import { ADMIN_CLIENT_ID } from '@/lib/auth/config';
import {
  OAuthError,
  exchangeAuthorizationCode,
  refreshTokens,
  type TokenSet,
} from '@/lib/auth/oauth';
import { noStore } from '@/lib/auth/session';

// Token endpoint (RFC 6749 §3.2). O painel troca o code internamente no
// callback; este endpoint existe para outros clientes (ex.: scripts) que
// queiram usar a API /api/admin com Bearer tokens.

function tokenResponse(tokens: TokenSet) {
  return noStore(
    NextResponse.json({
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: tokens.accessTokenExpiresAt - Math.floor(Date.now() / 1000),
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    }),
  );
}

function errorResponse(error: OAuthError) {
  return noStore(
    NextResponse.json(
      { error: error.error, error_description: error.description },
      { status: error.status },
    ),
  );
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return errorResponse(
      new OAuthError('invalid_request', 'Use application/x-www-form-urlencoded.'),
    );
  }

  const form = new URLSearchParams(await request.text());
  const grantType = form.get('grant_type');

  if (form.get('client_id') !== ADMIN_CLIENT_ID) {
    return errorResponse(new OAuthError('invalid_client', 'Cliente desconhecido.', 401));
  }

  try {
    if (grantType === 'authorization_code') {
      const code = form.get('code');
      const codeVerifier = form.get('code_verifier');
      const redirectUri = form.get('redirect_uri');

      if (!code || !codeVerifier || !redirectUri) {
        throw new OAuthError(
          'invalid_request',
          'code, code_verifier e redirect_uri são obrigatórios.',
        );
      }

      return tokenResponse(
        await exchangeAuthorizationCode({
          code,
          codeVerifier,
          clientId: ADMIN_CLIENT_ID,
          redirectUri,
        }),
      );
    }

    if (grantType === 'refresh_token') {
      const refreshToken = form.get('refresh_token');
      if (!refreshToken) {
        throw new OAuthError('invalid_request', 'refresh_token é obrigatório.');
      }
      return tokenResponse(await refreshTokens(refreshToken));
    }

    throw new OAuthError(
      'unsupported_grant_type',
      'Suportados: authorization_code e refresh_token.',
    );
  } catch (error) {
    if (error instanceof OAuthError) return errorResponse(error);
    throw error;
  }
}
