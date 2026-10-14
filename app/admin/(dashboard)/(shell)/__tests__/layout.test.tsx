/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { requireAdminPage } from '@/lib/auth/session';
import { countPendingUsers } from '@/lib/users/service';
import { AdminHeader } from '@/components/admin/admin-header';

import ShellLayout from '../layout';

// Layout servidor: sessão, contagem e cabeçalho mockados.
jest.mock('@/lib/auth/session', () => ({ requireAdminPage: jest.fn() }));
jest.mock('@/lib/users/service', () => ({ countPendingUsers: jest.fn(async () => 3) }));
jest.mock('@/components/admin/admin-header', () => ({
  AdminHeader: jest.fn(() => <header>cabeçalho do painel</header>),
}));

const sessionFor = (role: string) =>
  ({
    user: { id: 'u1', username: 'gaspar', name: 'Gaspar', role, avatarUrl: '' },
  }) as Awaited<ReturnType<typeof requireAdminPage>>;

describe('layout do painel', () => {
  it('cabeçalho e, depois dele, a área principal #painel com a página', async () => {
    jest.mocked(requireAdminPage).mockResolvedValue(sessionFor('owner'));
    render(await ShellLayout({ children: <p>conteúdo</p> }));

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'painel');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(main).toHaveTextContent('conteúdo');
    expect(screen.getByRole('banner')).not.toContainElement(main);
    expect(jest.mocked(AdminHeader).mock.calls[0][0]).toMatchObject({ pendingUsers: 3 });
  });

  it('quem não gerencia usuários nem consulta os pedidos pendentes', async () => {
    jest.mocked(requireAdminPage).mockResolvedValue(sessionFor('contributor'));
    render(await ShellLayout({ children: null }));
    expect(countPendingUsers).not.toHaveBeenCalled();
    expect(jest.mocked(AdminHeader).mock.calls[0][0]).toMatchObject({ pendingUsers: 0 });
  });
});
