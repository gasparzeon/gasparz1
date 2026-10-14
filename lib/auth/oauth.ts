import 'server-only';

import {
  ADMIN_CLIENT_ID,
  ADMIN_SCOPE,
  AUTH_CODE_TTL,
  CALLBACK_PATH,
  REFRESH_REUSE_GRACE,
  REFRESH_TOKEN_TTL,
  SESSION_MAX_AGE,
} from './config';
import { pkceChallenge, randomToken, safeEqual } from './crypto';
import { getSessionUser } from '@/lib/users/service';
import { getStore } from './store';
import { seal, signAccessToken, unseal, verifyAccessToken } from './tokens';

// Servidor de autorização OAuth 2.0 (RFC 6749) com Authorization Code +
// PKCE S256 obrigatório (RFC 7636), conforme o OAuth 2.0 Security BCP
// (RFC 9700). O dono do recurso se autentica com usuário e senha; o `sub`
// dos tokens é o id do usuário no banco.

export class OAuthError extends Error {
  constructor(
    readonly error:
      | 'invalid_request'
      | 'invalid_client'
      | 'invalid_grant'
      | 'invalid_scope'
      | 'unauthorized_client'
      | 'unsupported_grant_type'
      | 'unsupported_response_type'
      | 'access_denied'
      | 'temporarily_unavailable',
    readonly description: string,
    readonly status = 400,
  ) {
    super(description);
    this.name = 'OAuthError';
  }
}

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
};

export type AuthorizeValidation =
  | { ok: true; params: AuthorizeParams }
  // redirectTo só existe quando client_id e redirect_uri são confiáveis
  // (RFC 6749 §4.1.2.1: nunca redirecionar para URI não validada).
  | { ok: false; error: string; description: string; redirectTo?: string };

const CODE_CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const CODE_VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/;
const STATE_RE = /^[\x21-\x7e]{16,512}$/;

export function callbackUrl(origin: string) {
  return `${origin}${CALLBACK_PATH}`;
}

function normalizeScope(scope: string | undefined) {
  const allowed = new Set(ADMIN_SCOPE.split(' '));
  const requested = (scope ?? ADMIN_SCOPE).split(' ').filter(Boolean);
  if (requested.length === 0) return ADMIN_SCOPE;
  if (!requested.every((s) => allowed.has(s))) return null;
  return Array.from(new Set(requested)).join(' ');
}

export function buildRedirect(redirectUri: string, params: Record<string, string>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function validateAuthorizeRequest(
  input: Record<string, string | string[] | undefined>,
  origin: string,
): AuthorizeValidation {
  const get = (key: string) => {
    // eslint-disable-next-line security/detect-object-injection -- `key` é sempre um nome de parâmetro fixo do código
    const value = Object.hasOwn(input, key) ? input[key] : undefined;
    return Array.isArray(value) ? undefined : value;
  };

  const clientId = get('client_id');
  const redirectUri = get('redirect_uri');

  if (clientId !== ADMIN_CLIENT_ID) {
    return {
      ok: false,
      error: 'invalid_client',
      description: 'Cliente OAuth desconhecido.',
    };
  }

  if (!redirectUri || redirectUri !== callbackUrl(origin)) {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'redirect_uri não registrada para este cliente.',
    };
  }

  const state = get('state');
  const fail = (error: string, description: string): AuthorizeValidation => ({
    ok: false,
    error,
    description,
    redirectTo: buildRedirect(redirectUri, {
      error,
      error_description: description,
      ...(state ? { state } : {}),
    }),
  });

  if (get('response_type') !== 'code') {
    return fail('unsupported_response_type', 'Use response_type=code.');
  }
  if (!state || !STATE_RE.test(state)) {
    return fail('invalid_request', 'Parâmetro state ausente ou inválido.');
  }
  if (get('code_challenge_method') !== 'S256') {
    return fail('invalid_request', 'PKCE com S256 é obrigatório.');
  }

  const codeChallenge = get('code_challenge');
  if (!codeChallenge || !CODE_CHALLENGE_RE.test(codeChallenge)) {
    return fail('invalid_request', 'code_challenge inválido.');
  }

  const scope = normalizeScope(get('scope'));
  if (!scope) {
    return fail('invalid_scope', 'Escopo solicitado não é permitido.');
  }

  return {
    ok: true,
    params: { clientId, redirectUri, state, codeChallenge, scope },
  };
}

export async function issueAuthorizationCode(params: AuthorizeParams, subject: string) {
  return seal(
    'code',
    {
      sub: subject,
      cid: params.clientId,
      ruri: params.redirectUri,
      cc: params.codeChallenge,
      scope: params.scope,
    },
    Math.floor(Date.now() / 1000) + AUTH_CODE_TTL,
  );
}

export type TokenSet = {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  scope: string;
};

async function issueTokens(input: {
  sub: string;
  sid: string;
  scope: string;
  authTime: number;
}): Promise<TokenSet> {
  const now = Math.floor(Date.now() / 1000);
  const refreshExpiresAt = Math.min(now + REFRESH_TOKEN_TTL, input.authTime + SESSION_MAX_AGE);

  const access = await signAccessToken(input);
  const refreshToken = await seal(
    'refresh',
    {
      sub: input.sub,
      sid: input.sid,
      scope: input.scope,
      auth_time: input.authTime,
    },
    refreshExpiresAt,
  );

  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt,
    scope: input.scope,
  };
}

// O usuário precisa continuar ativo, e sessões anteriores a uma suspensão
// ou troca de senha (`sessionsValidAfter`) deixam de valer.
async function assertActiveUser(sub: string, issuedAt?: number) {
  const user = await getSessionUser(sub);
  if (!user || user.status !== 'active') {
    throw new OAuthError('invalid_grant', 'Usuário inativo ou removido.');
  }
  if (issuedAt !== undefined && issuedAt < Math.floor(user.sessionsValidAfter.getTime() / 1000)) {
    throw new OAuthError('invalid_grant', 'Sessão encerrada. Faça login novamente.');
  }
  return user;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const payload = await unseal<{
    sub: string;
    cid: string;
    ruri: string;
    cc: string;
    scope: string;
  }>('code', input.code);

  if (!payload) {
    throw new OAuthError('invalid_grant', 'Authorization code inválido ou expirado.');
  }
  if (payload.cid !== input.clientId) {
    throw new OAuthError('invalid_grant', 'Code emitido para outro cliente.');
  }
  if (payload.ruri !== input.redirectUri) {
    throw new OAuthError('invalid_grant', 'redirect_uri não confere.');
  }
  if (
    !CODE_VERIFIER_RE.test(input.codeVerifier) ||
    !safeEqual(pkceChallenge(input.codeVerifier), payload.cc)
  ) {
    throw new OAuthError('invalid_grant', 'code_verifier inválido.');
  }
  await assertActiveUser(payload.sub);

  const store = getStore();
  const sid = randomToken(16);

  // Uso único (RFC 6749 §4.1.2). Se o code for reapresentado, a sessão que
  // ele gerou é revogada.
  const firstUse = await store.set(`code:${payload.jti}`, sid, AUTH_CODE_TTL + 60, {
    nx: true,
  });

  if (!firstUse) {
    const issuedSid = await store.get(`code:${payload.jti}`);
    if (issuedSid) await revokeSession(issuedSid);
    throw new OAuthError('invalid_grant', 'Authorization code já utilizado.');
  }

  return issueTokens({
    sub: payload.sub,
    sid,
    scope: payload.scope,
    authTime: Math.floor(Date.now() / 1000),
  });
}

export class RefreshRaceError extends OAuthError {
  constructor() {
    super('invalid_grant', 'Refresh token já foi trocado por outra requisição.');
    this.name = 'RefreshRaceError';
  }
}

// Rotação de refresh token com detecção de reuso: um token trocado que
// reaparece depois da janela de tolerância derruba a sessão inteira.
export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  const payload = await unseal<{
    sub: string;
    sid: string;
    scope: string;
    auth_time: number;
  }>('refresh', refreshToken);

  if (!payload) {
    throw new OAuthError('invalid_grant', 'Refresh token inválido ou expirado.');
  }

  const now = Math.floor(Date.now() / 1000);

  if (now >= payload.auth_time + SESSION_MAX_AGE) {
    throw new OAuthError('invalid_grant', 'Sessão expirada. Faça login novamente.');
  }
  if (await isSessionRevoked(payload.sid)) {
    throw new OAuthError('invalid_grant', 'Sessão revogada.');
  }
  await assertActiveUser(payload.sub, payload.auth_time);

  const store = getStore();
  const usedKey = `rt:${payload.jti}`;
  const firstUse = await store.set(usedKey, String(now), payload.exp - now + 60, {
    nx: true,
  });

  if (!firstUse) {
    const usedAt = Number(await store.get(usedKey));
    if (usedAt && now - usedAt <= REFRESH_REUSE_GRACE) {
      throw new RefreshRaceError();
    }
    await revokeSession(payload.sid);
    throw new OAuthError('invalid_grant', 'Reuso de refresh token detectado.');
  }

  return issueTokens({
    sub: payload.sub,
    sid: payload.sid,
    scope: payload.scope,
    authTime: payload.auth_time,
  });
}

export async function revokeSession(sid: string) {
  await getStore().set(`sid:${sid}:revoked`, '1', SESSION_MAX_AGE);
}

export async function isSessionRevoked(sid: string) {
  return (await getStore().get(`sid:${sid}:revoked`)) !== null;
}

// RFC 7009: aceita access ou refresh token e revoga a sessão inteira.
export async function revokeToken(token: string) {
  const refresh = await unseal<{ sid: string }>('refresh', token);
  if (refresh?.sid) {
    await revokeSession(refresh.sid);
    return;
  }

  const access = await verifyAccessToken(token);
  if (access) await revokeSession(access.sid);
}
