/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { requestAccessAction } from '@/app/admin/account-actions';

import { SignupForm } from '../account-forms';

jest.mock('@/app/admin/account-actions', () => ({ requestAccessAction: jest.fn() }));

const mockAction = requestAccessAction as jest.Mock;

const fill = () => {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Léo' } });
  fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'leo' } });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'leo@x.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'frase-senha-longa' } });
  fireEvent.change(screen.getByLabelText('Confirmar senha'), {
    target: { value: 'frase-senha-longa' },
  });
};

beforeEach(() => {
  mockAction.mockReset();
});

describe('<SignupForm /> (conta de leitor)', () => {
  it('envia sem o campo de mensagem e mostra o sucesso com o botão Entrar', async () => {
    mockAction.mockImplementation(async (_prev: unknown, formData: FormData) => {
      expect(formData.has('note')).toBe(false);
      return { ok: true };
    });
    render(<SignupForm />);
    expect(screen.queryByLabelText(/escrever/)).not.toBeInTheDocument();

    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(screen.getByText('Conta criada')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/api/auth/login');
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('erro do servidor aparece em alerta, sem sair da tela', async () => {
    mockAction.mockResolvedValue({ error: 'Usuário ou e-mail já cadastrado.' });
    render(<SignupForm />);

    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Usuário ou e-mail já cadastrado.'),
    );
    expect(screen.queryByText('Conta criada')).not.toBeInTheDocument();
  });
});
