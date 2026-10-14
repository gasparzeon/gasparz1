/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { KeyRound } from 'lucide-react';

import { AuthNotice, AuthShell } from '../auth-shell';

jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

describe('<AuthShell /> (login, cadastro, convite…)', () => {
  it('"Voltar ao site" antes de tudo, na mesma aba', () => {
    render(<AuthShell>formulário</AuthShell>);
    const back = screen.getByRole('link', { name: 'Voltar ao site' });
    expect(back).toHaveAttribute('href', '/');
    expect(back).not.toHaveAttribute('target');
    expect(screen.getByRole('banner')).toContainElement(back);
  });

  it('o formulário fica na área principal (alvo #painel)', () => {
    render(<AuthShell>formulário</AuthShell>);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'painel');
    expect(within(main).getByText('formulário')).toBeInTheDocument();
    expect(
      within(main).getByRole('heading', { level: 1, name: 'Painel do arquivo' }),
    ).toBeInTheDocument();
  });
});

describe('<AuthNotice />', () => {
  it('título, texto e ação', () => {
    render(<AuthNotice icon={KeyRound} title="Link expirado" description="Peça outro." />);
    expect(screen.getByRole('heading', { level: 2, name: 'Link expirado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/api/auth/login');
  });
});
