/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { authorize } from '@/app/admin/login/actions';

import { LoginForm } from '../login-form';

// A server action é substituída por um mock: o teste cobre só a UI.
jest.mock('@/app/admin/login/actions', () => ({ authorize: jest.fn() }));

const mockAuthorize = authorize as jest.Mock;

const oauth = {
  response_type: 'code',
  client_id: 'gaspar-admin',
  redirect_uri: 'http://localhost/api/auth/callback',
  scope: 'posts:write media:write',
  state: 'estado-123456789012',
  code_challenge: 'c'.repeat(43),
  code_challenge_method: 'S256',
};

function submit(username: string, password: string) {
  fireEvent.change(screen.getByLabelText('Usuário ou e-mail'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
}

describe('<LoginForm />', () => {
  it('envia usuário, senha e todos os parâmetros OAuth para a action', async () => {
    mockAuthorize.mockResolvedValue({ error: 'Usuário ou senha inválidos.' });
    render(<LoginForm oauth={oauth} />);

    submit('gaspar', 'segredo');

    await waitFor(() => expect(mockAuthorize).toHaveBeenCalledTimes(1));
    const formData = mockAuthorize.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(formData)).toEqual({
      ...oauth,
      username: 'gaspar',
      password: 'segredo',
    });
  });

  it('mostra o erro e mantém o usuário digitado', async () => {
    mockAuthorize.mockResolvedValue({ error: 'Usuário ou senha inválidos.' });
    render(<LoginForm oauth={oauth} />);

    submit('gaspar', 'errada');

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha inválidos.');
    expect(screen.getByLabelText('Usuário ou e-mail')).toHaveValue('gaspar');
  });

  it('bloqueia o botão durante a espera do rate limit e libera depois', async () => {
    jest.useFakeTimers();
    mockAuthorize.mockResolvedValue({ error: 'Muitas tentativas.', retryAfter: 2 });
    render(<LoginForm oauth={oauth} />);

    submit('gaspar', 'x');

    expect(await screen.findByRole('alert')).toHaveTextContent('Tente em 2s.');
    expect(screen.getByRole('button', { name: /entrar/i })).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: /entrar/i })).toBeEnabled();
    jest.useRealTimers();
  });

  it('alterna a visibilidade da senha', () => {
    render(<LoginForm oauth={oauth} />);
    const password = screen.getByLabelText('Senha');

    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});
