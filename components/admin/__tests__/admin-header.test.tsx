/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { AdminHeader } from '../admin-header';

let mockPathname = '/admin';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

type Role = 'reader' | 'editor' | 'owner';
const user = (role: Role) => ({
  name: role === 'reader' ? 'Leitor' : 'Ed',
  username: role,
  role,
  avatarUrl: '',
});

const panelNav = () => screen.getByRole('navigation', { name: 'Painel' });
const openAccount = (name: string) =>
  fireEvent.keyDown(screen.getByRole('button', { name: `Conta de ${name}` }), { key: 'Enter' });

beforeEach(() => {
  mockPathname = '/admin';
});

describe('<AdminHeader /> por papel', () => {
  it('editor vê Posts, Comentários e Novo post', () => {
    render(<AdminHeader user={user('editor')} />);
    expect(within(panelNav()).getByRole('link', { name: 'Posts' })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(within(panelNav()).getByRole('link', { name: 'Comentários' })).toHaveAttribute(
      'href',
      '/admin/comentarios',
    );
    expect(screen.getByRole('link', { name: /Novo post/ })).toHaveAttribute(
      'href',
      '/admin/posts/new',
    );
  });

  it('leitor vê só Perfil, sem Posts nem Novo post', () => {
    render(<AdminHeader user={user('reader')} />);
    expect(screen.queryByRole('link', { name: 'Posts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Comentários' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Novo post/ })).not.toBeInTheDocument();
    expect(within(panelNav()).getByRole('link', { name: 'Perfil' })).toBeInTheDocument();
  });

  it('dono vê também Usuários (com pendentes), Site e Páginas', () => {
    render(<AdminHeader user={user('owner')} pendingUsers={2} />);
    const nav = panelNav();
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Posts', 'Comentários', 'Usuários2', 'Site', 'Páginas', 'Perfil']);
    expect(within(nav).getByLabelText('2 pendentes')).toBeInTheDocument();
  });
});

describe('<AdminHeader /> — navegação', () => {
  it('"Voltar ao site" sempre à vista, na mesma aba, levando ao início do site', () => {
    render(<AdminHeader user={user('editor')} />);
    const back = screen.getByRole('link', { name: 'Voltar ao site' });
    expect(back).toHaveAttribute('href', '/');
    expect(back).not.toHaveAttribute('target');
  });

  it('logo leva ao início do painel e diz isso', () => {
    render(<AdminHeader user={user('editor')} />);
    expect(screen.getByRole('link', { name: /início do painel/ })).toHaveAttribute(
      'href',
      '/admin',
    );
  });

  it('primeiro item: "Pular para o conteúdo" até a área principal do painel', () => {
    const { container } = render(<AdminHeader user={user('editor')} />);
    const skip = screen.getByRole('link', { name: 'Pular para o conteúdo' });
    expect(skip).toHaveAttribute('href', '#painel');
    expect(container.querySelector('a')).toBe(skip);
  });

  it.each([
    ['/admin', 'Posts', 'page'],
    ['/admin/comentarios', 'Comentários', 'page'],
    ['/admin/paginas/123', 'Páginas', 'true'],
    ['/admin/posts/abc', 'Posts', 'true'],
  ])('em %s, "%s" é o atual (aria-current="%s") e só ele', (path, label, state) => {
    mockPathname = path;
    render(<AdminHeader user={user('owner')} />);
    const links = within(panelNav()).getAllByRole('link');
    const current = links.filter((link) => link.hasAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
    expect(current[0]).toHaveAttribute('aria-current', state);
  });

  it('menu da conta: perfil, página de autor, voltar ao site e sair', () => {
    render(<AdminHeader user={user('editor')} />);
    openAccount('Ed');
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Meu perfil' })).toHaveAttribute(
      'href',
      '/admin/perfil',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Minha página de autor' })).toHaveAttribute(
      'href',
      '/autores/editor',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Voltar ao site' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Sair' })).toBeInTheDocument();
  });

  it('leitor não tem página de autor no menu da conta', () => {
    render(<AdminHeader user={user('reader')} />);
    openAccount('Leitor');
    expect(
      screen.queryByRole('menuitem', { name: 'Minha página de autor' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Voltar ao site' })).toBeInTheDocument();
  });
});
