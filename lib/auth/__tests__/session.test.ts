import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { isSessionRevoked } from '../oauth';
import { COOKIES } from '../config';
import {
  authenticateRequest,
  clearSessionCookies,
  getClientIp,
  getRequestOrigin,
  isSameOriginRequest,
  requireAdminPage,
  sanitizeReturnTo,
  setSessionCookies,
} from '../session';
import { signAccessToken } from '../tokens';
import { getSessionUser } from '@/lib/users/service';

jest.mock('next/headers', () => ({ cookies: jest.fn(), headers: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
jest.mock('../oauth', () => ({ isSessionRevoked: jest.fn() }));
jest.mock('@/lib/users/service', () => ({ getSessionUser: jest.fn() }));

const mockCookies = cookies as jest.Mock;
const mockRevoked = isSessionRevoked as jest.Mock;
const mockGetUser = getSessionUser as jest.Mock;

const USER_ID = '0b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';
const activeUser = {
  id: USER_ID,
  username: 'gaspar',
  name: 'Gaspar',
  role: 'editor',
  status: 'active',
  avatarUrl: '',
  sessionsValidAfter: new Date(Date.now() - 60_000),
};

function cookieJar(values: Record<string, string>) {
  return {
    get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
  };
}

async function accessToken(sid = 'sessao-1') {
  return (await signAccessToken({ sub: USER_ID, sid, scope: 'posts:write media:write' })).token;
}

beforeEach(() => {
  mockRevoked.mockResolvedValue(false);
  mockGetUser.mockResolvedValue(activeUser);
  mockCookies.mockResolvedValue(cookieJar({}));
});

describe('sanitizeReturnTo (open redirect)', () => {
  it.each([
    ['/admin/posts/novo?x=1', '/admin/posts/novo?x=1'],
    ['/admin', '/admin'],
    [null, '/admin'],
    ['https://evil.com/admin', '/admin'],
    ['//evil.com/admin', '/admin'],
    ['/\\evil.com', '/admin'],
    ['/admin/login?x', '/admin'],
    ['/administrador', '/admin'],
    ['/admin/../api/auth/logout', '/admin'],
    // Volta ao site (fluxo de comentários): só home e posts.
    ['/', '/'],
    ['/posts', '/posts'],
    ['/posts/qualquer?x=1', '/posts/qualquer?x=1'],
    ['/sobre', '/admin'],
    ['/posts/../admin', '/admin'],
  ])('%s → %s', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });
});

describe('cabeçalhos da requisição', () => {
  it('monta a origem a partir dos cabeçalhos do proxy', () => {
    const headers = new Headers({
      host: 'interno:3000',
      'x-forwarded-host': 'gasparlabs.com.br',
      'x-forwarded-proto': 'https,http',
    });
    expect(getRequestOrigin(headers)).toBe('https://gasparlabs.com.br');
    expect(getRequestOrigin(new Headers({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });

  it('extrai o IP do cliente', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }))).toBe(
      '203.0.113.1',
    );
    expect(getClientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});

describe('isSameOriginRequest (CSRF)', () => {
  const request = (headers: Record<string, string>) =>
    new Request('http://localhost:3000/api/admin/posts', {
      method: 'POST',
      headers: { host: 'localhost:3000', ...headers },
    });

  it('aceita a própria origem', () => {
    expect(isSameOriginRequest(request({ origin: 'http://localhost:3000' }))).toBe(true);
    expect(isSameOriginRequest(request({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
  });

  it('recusa outra origem ou requisição sem origem identificável', () => {
    expect(isSameOriginRequest(request({ origin: 'https://evil.example' }))).toBe(false);
    expect(
      isSameOriginRequest(
        request({ origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' }),
      ),
    ).toBe(false);
    expect(isSameOriginRequest(request({}))).toBe(false);
  });
});

describe('authenticateRequest', () => {
  it('aceita Bearer token válido (RFC 6750)', async () => {
    const token = await accessToken();
    const request = new Request('http://x/api', { headers: { authorization: `Bearer ${token}` } });

    await expect(authenticateRequest(request)).resolves.toMatchObject({
      viaCookie: false,
      session: { user: { id: USER_ID, username: 'gaspar', role: 'editor' }, sid: 'sessao-1' },
    });
  });

  it('usa o cookie do painel quando não há Bearer', async () => {
    mockCookies.mockResolvedValue(cookieJar({ 'gaspar.at': await accessToken('do-cookie') }));

    const result = await authenticateRequest(new Request('http://x/api'));
    expect(result).toMatchObject({ viaCookie: true, session: { sid: 'do-cookie' } });
  });

  it('recusa usuário suspenso ou removido mesmo com JWT válido', async () => {
    const token = await accessToken();
    const request = new Request('http://x/api', { headers: { authorization: `Bearer ${token}` } });

    mockGetUser.mockResolvedValue({ ...activeUser, status: 'suspended' });
    await expect(authenticateRequest(request)).resolves.toMatchObject({ session: null });

    mockGetUser.mockResolvedValue(null);
    await expect(authenticateRequest(request)).resolves.toMatchObject({ session: null });
  });

  it('recusa tokens emitidos antes de uma troca de senha', async () => {
    const token = await accessToken();
    mockGetUser.mockResolvedValue({
      ...activeUser,
      sessionsValidAfter: new Date(Date.now() + 2000),
    });

    const request = new Request('http://x/api', { headers: { authorization: `Bearer ${token}` } });
    await expect(authenticateRequest(request)).resolves.toMatchObject({ session: null });
  });

  it('recusa sessões revogadas mesmo com JWT válido', async () => {
    mockRevoked.mockResolvedValue(true);
    const token = await accessToken();
    const request = new Request('http://x/api', { headers: { authorization: `Bearer ${token}` } });

    await expect(authenticateRequest(request)).resolves.toMatchObject({ session: null });
  });
});

describe('requireAdminPage', () => {
  it('redireciona para o refresh com o caminho de volta', async () => {
    await expect(requireAdminPage('/admin/posts/x')).rejects.toThrow(
      'NEXT_REDIRECT:/api/auth/refresh?returnTo=%2Fadmin%2Fposts%2Fx',
    );
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});

describe('cookies de sessão', () => {
  // Captura o que seria gravado na resposta.
  const fakeResponse = () => {
    const set = jest.fn();
    return {
      response: { cookies: { set } } as unknown as Parameters<typeof setSessionCookies>[0],
      set,
    };
  };
  const now = Math.floor(Date.now() / 1000);
  const tokens = {
    accessToken: 'at',
    accessTokenExpiresAt: now + 900,
    refreshToken: 'rt',
    refreshTokenExpiresAt: now + 3600,
    scope: 'posts:write',
  };

  it('tokens ficam httpOnly; a dica do cabeçalho é legível mas não carrega dado', () => {
    const { response, set } = fakeResponse();
    setSessionCookies(response, tokens);

    const byName = Object.fromEntries(
      set.mock.calls.map(([name, value, options]) => [name, { value, options }]),
    );
    expect(byName[COOKIES.access].options).toMatchObject({ httpOnly: true, sameSite: 'strict' });
    expect(byName[COOKIES.refresh].options).toMatchObject({ httpOnly: true, path: '/api/auth' });
    expect(byName[COOKIES.hint]).toEqual({
      value: '1',
      options: expect.objectContaining({ httpOnly: false, path: '/' }),
    });
  });

  it('logout apaga também a dica', () => {
    const { response, set } = fakeResponse();
    clearSessionCookies(response);
    expect(set).toHaveBeenCalledWith(COOKIES.hint, '', expect.objectContaining({ maxAge: 0 }));
  });
});
