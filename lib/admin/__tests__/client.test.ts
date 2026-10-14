import { ApiError, adminFetch, getSessionExpiry, refreshSession } from '../client';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

let fetchMock: jest.Mock;
const assign = jest.fn();

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  // O cliente roda no navegador: um `window` mínimo basta para os testes.
  Object.assign(globalThis, {
    window: { location: { pathname: '/admin/posts/x', search: '?a=1', assign } },
  });
  assign.mockClear();
});

describe('adminFetch', () => {
  it('envia JSON e devolve o corpo', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(adminFetch('/api/admin/posts', { method: 'POST', body: '{}' })).resolves.toEqual({
      ok: true,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
  });

  it('renova a sessão no 401 e repete a requisição uma vez', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
      .mockResolvedValueOnce(json(200, { expiresAt: 1_900_000_000 }))
      .mockResolvedValueOnce(json(200, { posts: [] }));

    await expect(adminFetch('/api/admin/posts')).resolves.toEqual({ posts: [] });
    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)).toEqual([
      'GET /api/admin/posts',
      'POST /api/auth/refresh',
      'GET /api/admin/posts',
    ]);
    expect(getSessionExpiry()).toBe(1_900_000_000);
  });

  it('manda para o login quando o refresh falha', async () => {
    fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(401));

    await expect(adminFetch('/api/admin/posts')).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith('/api/auth/login?returnTo=%2Fadmin%2Fposts%2Fx%3Fa%3D1');
  });

  it('expõe mensagem e código de erro da API', async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: 'conflict', message: 'Mudou' }));

    const error = await adminFetch('/api/admin/posts/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'conflict', message: 'Mudou' });
  });

  it('trata falha de rede sem redirecionar', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(adminFetch('/api/admin/posts')).rejects.toMatchObject({ status: 0 });
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('refreshSession', () => {
  it('faz uma única requisição para chamadas simultâneas', async () => {
    fetchMock.mockResolvedValue(json(200, { expiresAt: 123 }));

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('considera ok quando outra aba renovou ao mesmo tempo (409)', async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: 'concurrent' }));
    await expect(refreshSession()).resolves.toEqual({ ok: true });
  });

  it('distingue sessão expirada de falta de rede', async () => {
    fetchMock.mockResolvedValueOnce(json(401));
    await expect(refreshSession()).resolves.toEqual({ ok: false, reason: 'expired' });

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(refreshSession()).resolves.toEqual({ ok: false, reason: 'network' });
  });
});
