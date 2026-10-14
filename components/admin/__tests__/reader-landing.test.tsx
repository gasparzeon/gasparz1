/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { ReaderLanding } from '../reader-landing';

describe('<ReaderLanding />', () => {
  it('cumprimenta pelo primeiro nome e mostra os caminhos do leitor', () => {
    render(<ReaderLanding name="Leitora Silva" />);
    expect(screen.getByRole('heading', { name: 'Olá, Leitora' })).toBeInTheDocument();
    expect(screen.getByText(/conta é de leitor/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver site' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute(
      'href',
      '/admin/perfil',
    );
    const logout = screen.getByRole('button', { name: 'Sair' }).closest('form');
    expect(logout).toHaveAttribute('action', '/api/auth/logout');
  });
});
