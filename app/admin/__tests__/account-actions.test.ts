import { consumeSignupAttempt } from '@/lib/auth/rate-limit';
import { registerReader } from '@/lib/users/service';

import { requestAccessAction } from '../account-actions';

jest.mock('next/headers', () => ({
  headers: jest.fn(async () => new Headers({ 'x-forwarded-for': '1.1.1.1' })),
}));
jest.mock('@/lib/auth/rate-limit', () => ({ consumeSignupAttempt: jest.fn() }));
jest.mock('@/lib/users/service', () => {
  const { UserError } = jest.requireActual('@/lib/users/service');
  return { UserError, registerReader: jest.fn() };
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const valid = () =>
  form({
    name: 'Léo',
    username: 'leo',
    email: 'leo@x.com',
    password: 'frase-senha-longa',
    confirm: 'frase-senha-longa',
  });

beforeEach(() => {
  jest.clearAllMocks();
  (consumeSignupAttempt as jest.Mock).mockResolvedValue({ allowed: true });
  (registerReader as jest.Mock).mockResolvedValue({ id: 'novo-id' });
});

describe('requestAccessAction (cadastro de leitor)', () => {
  it('cria a conta e devolve ok (a tela mostra o sucesso com o botão Entrar)', async () => {
    await expect(requestAccessAction({}, valid())).resolves.toEqual({ ok: true });
    expect(registerReader).toHaveBeenCalledWith({
      name: 'Léo',
      username: 'leo',
      email: 'leo@x.com',
      password: 'frase-senha-longa',
    });
  });

  it('confirmação diferente da senha não cria nada', async () => {
    const data = valid();
    data.set('confirm', 'outra-senha-longa');
    await expect(requestAccessAction({}, data)).resolves.toMatchObject({
      error: 'A confirmação não confere com a senha.',
    });
    expect(registerReader).not.toHaveBeenCalled();
  });

  it('rate limit por IP devolve erro amigável', async () => {
    (consumeSignupAttempt as jest.Mock).mockResolvedValue({ allowed: false, retryAfter: 60 });
    await expect(requestAccessAction({}, valid())).resolves.toMatchObject({
      error: expect.stringMatching(/Muitas contas/),
    });
    expect(registerReader).not.toHaveBeenCalled();
  });

  it('erro do serviço (ex.: cadastro fechado, duplicado) preserva a mensagem', async () => {
    const { UserError } = jest.requireMock('@/lib/users/service');
    (registerReader as jest.Mock).mockRejectedValue(
      new UserError('Usuário ou e-mail já cadastrado.', 409, 'exists'),
    );
    const state = await requestAccessAction({}, valid());
    expect(state).toMatchObject({ error: 'Usuário ou e-mail já cadastrado.' });
    expect(state.fields).toMatchObject({ username: 'leo' });
  });
});
