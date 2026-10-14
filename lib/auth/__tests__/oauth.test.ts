import { pkceChallenge, randomToken } from '../crypto';
import {
  OAuthError,
  RefreshRaceError,
  buildRedirect,
  callbackUrl,
  exchangeAuthorizationCode,
  isSessionRevoked,
  issueAuthorizationCode,
  refreshTokens,
  revokeToken,
  validateAuthorizeRequest,
  type AuthorizeParams,
} from '../oauth';
import { verifyAccessToken } from '../tokens';
import { getSessionUser } from '@/lib/users/service';
import type { FakeStore } from '@/test/helpers/fake-store';

// O estado de segurança (codes usados, refresh trocados, revogações) vai
// para um store em memória controlado pelo teste.
jest.mock('@/lib/auth/store', () => {
  const { createFakeStore } = jest.requireActual('@/test/helpers/fake-store');
  const store = createFakeStore();
  return { getStore: () => store, __store: store };
});

const { __store: store } = jest.requireMock('@/lib/auth/store') as { __store: FakeStore };

// Usuários vêm do banco; aqui, de um mock controlado pelo teste.
jest.mock('@/lib/users/service', () => ({ getSessionUser: jest.fn() }));
const mockGetUser = getSessionUser as jest.Mock;

const USER_ID = '0b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';
let user: { status: string; sessionsValidAfter: Date } | null;

const ORIGIN = 'https://gasparlabs.com.br';

function authorizeQuery(overrides: Record<string, string | undefined> = {}) {
  return {
    response_type: 'code',
    client_id: 'gaspar-admin',
    redirect_uri: callbackUrl(ORIGIN),
    scope: 'posts:write media:write',
    state: 'estado-aleatorio-123456',
    code_challenge: pkceChallenge(randomToken(32)),
    code_challenge_method: 'S256',
    ...overrides,
  };
}

async function loginFlow() {
  const verifier = randomToken(48);
  const validation = validateAuthorizeRequest(
    authorizeQuery({ code_challenge: pkceChallenge(verifier) }),
    ORIGIN,
  );
  if (!validation.ok) throw new Error('requisição inválida');

  const code = await issueAuthorizationCode(validation.params, USER_ID);
  return { code, verifier, params: validation.params };
}

function exchange(code: string, verifier: string, params: AuthorizeParams) {
  return exchangeAuthorizationCode({
    code,
    codeVerifier: verifier,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
  });
}

beforeEach(() => {
  store.data.clear();
  user = { status: 'active', sessionsValidAfter: new Date(Date.now() - 60_000) };
  mockGetUser.mockImplementation(async (id: string) =>
    id === USER_ID && user
      ? { id, username: 'gaspar', name: 'Gaspar', role: 'owner', avatarUrl: '', ...user }
      : null,
  );
});

describe('validateAuthorizeRequest', () => {
  it('aceita a requisição do painel', () => {
    const result = validateAuthorizeRequest(authorizeQuery(), ORIGIN);
    expect(result).toMatchObject({ ok: true, params: { clientId: 'gaspar-admin' } });
  });

  it('não redireciona para client_id ou redirect_uri desconhecidos (RFC 6749 §4.1.2.1)', () => {
    const badClient = validateAuthorizeRequest(authorizeQuery({ client_id: 'evil' }), ORIGIN);
    expect(badClient).toMatchObject({ ok: false, error: 'invalid_client' });
    expect(badClient).not.toHaveProperty('redirectTo');

    const badRedirect = validateAuthorizeRequest(
      authorizeQuery({ redirect_uri: 'https://evil.example/api/auth/callback' }),
      ORIGIN,
    );
    expect(badRedirect).toMatchObject({ ok: false, error: 'invalid_request' });
    expect(badRedirect).not.toHaveProperty('redirectTo');
  });

  it.each([
    ['response_type', 'token', 'unsupported_response_type'],
    ['code_challenge_method', 'plain', 'invalid_request'],
    ['code_challenge', 'curto', 'invalid_request'],
    ['state', undefined, 'invalid_request'],
    ['scope', 'admin:tudo', 'invalid_scope'],
  ])('%s=%s gera %s redirecionando ao callback com o state', (field, value, error) => {
    const result = validateAuthorizeRequest(authorizeQuery({ [field]: value }), ORIGIN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(error);
    expect(result.redirectTo).toContain(`${ORIGIN}/api/auth/callback?error=${error}`);
  });

  it('ignora parâmetros repetidos (arrays)', () => {
    const result = validateAuthorizeRequest(
      { ...authorizeQuery(), client_id: ['gaspar-admin', 'evil'] },
      ORIGIN,
    );
    expect(result).toMatchObject({ ok: false, error: 'invalid_client' });
  });
});

describe('buildRedirect', () => {
  it('codifica os parâmetros na URL', () => {
    expect(buildRedirect('https://a.com/cb?x=1', { code: 'a b', state: 's&t' })).toBe(
      'https://a.com/cb?x=1&code=a+b&state=s%26t',
    );
  });
});

describe('troca do authorization code', () => {
  it('emite access e refresh tokens com PKCE válido', async () => {
    const { code, verifier, params } = await loginFlow();
    const tokens = await exchange(code, verifier, params);

    const claims = await verifyAccessToken(tokens.accessToken);
    expect(claims).toMatchObject({ sub: USER_ID, scope: 'posts:write media:write' });
    expect(tokens.refreshToken).not.toBe(tokens.accessToken);
  });

  it('recusa code_verifier errado sem consumir o code', async () => {
    const { code, verifier, params } = await loginFlow();

    await expect(exchange(code, randomToken(48), params)).rejects.toMatchObject({
      error: 'invalid_grant',
    });
    await expect(exchange(code, verifier, params)).resolves.toHaveProperty('accessToken');
  });

  it('recusa redirect_uri diferente da usada na autorização', async () => {
    const { code, verifier, params } = await loginFlow();
    await expect(
      exchange(code, verifier, { ...params, redirectUri: 'https://outro.com/api/auth/callback' }),
    ).rejects.toBeInstanceOf(OAuthError);
  });

  it('reuso do code é recusado e revoga a sessão emitida por ele', async () => {
    const { code, verifier, params } = await loginFlow();
    const tokens = await exchange(code, verifier, params);
    const { sid } = (await verifyAccessToken(tokens.accessToken))!;

    await expect(exchange(code, verifier, params)).rejects.toMatchObject({
      description: 'Authorization code já utilizado.',
    });
    await expect(isSessionRevoked(sid)).resolves.toBe(true);
  });

  it('recusa o code de um usuário suspenso ou removido', async () => {
    const { code, verifier, params } = await loginFlow();
    user = { status: 'suspended', sessionsValidAfter: new Date() };
    await expect(exchange(code, verifier, params)).rejects.toMatchObject({
      error: 'invalid_grant',
      description: 'Usuário inativo ou removido.',
    });
  });
});

describe('rotação de refresh token', () => {
  async function session() {
    const { code, verifier, params } = await loginFlow();
    return exchange(code, verifier, params);
  }

  it('troca o refresh token a cada uso e mantém a sessão', async () => {
    const first = await session();
    const second = await refreshTokens(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    const a = await verifyAccessToken(first.accessToken);
    const b = await verifyAccessToken(second.accessToken);
    expect(b?.sid).toBe(a?.sid);
  });

  it('reuso dentro da janela de tolerância é tratado como corrida entre abas', async () => {
    const first = await session();
    await refreshTokens(first.refreshToken);

    await expect(refreshTokens(first.refreshToken)).rejects.toBeInstanceOf(RefreshRaceError);
    const { sid } = (await verifyAccessToken(first.accessToken))!;
    await expect(isSessionRevoked(sid)).resolves.toBe(false);
  });

  it('reuso depois da janela é tratado como roubo e derruba a sessão', async () => {
    const first = await session();
    const second = await refreshTokens(first.refreshToken);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);

    await expect(refreshTokens(first.refreshToken)).rejects.toMatchObject({
      description: 'Reuso de refresh token detectado.',
    });
    await expect(refreshTokens(second.refreshToken)).rejects.toMatchObject({
      description: 'Sessão revogada.',
    });
  });

  it('troca de senha ou suspensão invalidam refresh tokens anteriores', async () => {
    const first = await session();
    user = { status: 'active', sessionsValidAfter: new Date(Date.now() + 2000) };

    await expect(refreshTokens(first.refreshToken)).rejects.toMatchObject({
      description: 'Sessão encerrada. Faça login novamente.',
    });
  });

  it('não aceita access token no lugar do refresh token', async () => {
    const first = await session();
    await expect(refreshTokens(first.accessToken)).rejects.toMatchObject({
      error: 'invalid_grant',
    });
  });

  it('respeita a duração máxima absoluta da sessão (30 dias)', async () => {
    const first = await session();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000);
    await expect(refreshTokens(first.refreshToken)).rejects.toMatchObject({
      description: 'Sessão expirada. Faça login novamente.',
    });
  });
});

describe('revokeToken (RFC 7009)', () => {
  it('revoga a sessão a partir do refresh token', async () => {
    const { code, verifier, params } = await loginFlow();
    const tokens = await exchange(code, verifier, params);
    const { sid } = (await verifyAccessToken(tokens.accessToken))!;

    await revokeToken(tokens.refreshToken);
    await expect(isSessionRevoked(sid)).resolves.toBe(true);
    await expect(refreshTokens(tokens.refreshToken)).rejects.toMatchObject({
      description: 'Sessão revogada.',
    });
  });

  it('revoga a sessão a partir do access token e ignora lixo', async () => {
    const { code, verifier, params } = await loginFlow();
    const tokens = await exchange(code, verifier, params);
    const { sid } = (await verifyAccessToken(tokens.accessToken))!;

    await expect(revokeToken('lixo')).resolves.toBeUndefined();
    await revokeToken(tokens.accessToken);
    await expect(isSessionRevoked(sid)).resolves.toBe(true);
  });
});
