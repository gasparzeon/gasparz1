import { cookies } from 'next/headers';

import { COOKIES, REQUEST_PATH, REQUEST_TICKET_TTL } from '../config';
import { clearRequestTicket, readRequestTicket, setRequestTicket } from '../request-ticket';
import { seal } from '../tokens';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

const mockCookies = cookies as jest.Mock;
const USER_ID = '0b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';

// Cookie store em memória com a mesma API usada pelo Next.
function jar() {
  const values = new Map<string, string>();
  const set = jest.fn<void, [name: string, value: string, options?: object]>((name, value) => {
    values.set(name, value);
  });
  return {
    set,
    get: (name: string) => (values.has(name) ? { name, value: values.get(name)! } : undefined),
    raw: values,
  };
}

let store: ReturnType<typeof jar>;

beforeEach(() => {
  store = jar();
  mockCookies.mockResolvedValue(store);
});

describe('ticket do pedido de acesso', () => {
  it('grava um cookie cifrado, httpOnly, Strict e restrito à página do pedido', async () => {
    await setRequestTicket(USER_ID);

    const [name, value, options] = store.set.mock.calls[0];
    expect(name).toBe(COOKIES.request);
    expect(value).not.toContain(USER_ID);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: REQUEST_PATH,
      maxAge: REQUEST_TICKET_TTL,
    });
    await expect(readRequestTicket()).resolves.toBe(USER_ID);
  });

  it('não existe sem cookie e recusa valor adulterado', async () => {
    await expect(readRequestTicket()).resolves.toBeNull();

    await setRequestTicket(USER_ID);
    const value = store.raw.get(COOKIES.request)!;
    store.raw.set(COOKIES.request, `${value.slice(0, -4)}AAAA`);
    await expect(readRequestTicket()).resolves.toBeNull();
  });

  it('não aceita outros tokens cifrados com a mesma chave (propósito diferente)', async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    store.raw.set(COOKIES.request, await seal('tx', { sub: USER_ID }, exp));
    await expect(readRequestTicket()).resolves.toBeNull();
  });

  it('recusa ticket expirado', async () => {
    const past = Math.floor(Date.now() / 1000) - 1;
    store.raw.set(COOKIES.request, await seal('request', { sub: USER_ID }, past));
    await expect(readRequestTicket()).resolves.toBeNull();
  });

  it('sair apaga o cookie', async () => {
    await clearRequestTicket();
    expect(store.set).toHaveBeenCalledWith(
      COOKIES.request,
      '',
      expect.objectContaining({ maxAge: 0, path: REQUEST_PATH }),
    );
  });
});
