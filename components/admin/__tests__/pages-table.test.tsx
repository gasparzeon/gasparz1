/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import { adminFetch } from '@/lib/admin/client';
import type { PageSummary } from '@/lib/site/pages-schema';

import { PagesTable } from '../pages/pages-table';

jest.mock('@/lib/admin/client', () => ({ adminFetch: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockRouter = { refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const pages: PageSummary[] = [
  {
    id: 'p1',
    slug: 'about',
    title: 'Sobre',
    status: 'published',
    version: 3,
    updatedAt: '2026-10-12T00:00:00Z',
    updatedBy: { id: 'a1', name: 'Ana' },
  },
  {
    id: 'p2',
    slug: 'privacidade',
    title: 'Privacidade',
    status: 'draft',
    version: 1,
    updatedAt: '2026-10-12T00:00:00Z',
    updatedBy: null,
  },
];

describe('<PagesTable />', () => {
  it('mostra status, endereço, quem editou e o link "Ver" só nas publicadas', () => {
    render(<PagesTable pages={pages} />);
    const about = screen.getByText('Sobre').closest('li') as HTMLElement;
    expect(within(about).getByText('Publicada')).toBeInTheDocument();
    expect(within(about).getByText(/\/about · atualizada em .* por Ana/)).toBeInTheDocument();
    const view = within(about).getByRole('link', { name: /Ver/ });
    expect(view).toHaveAttribute('href', '/about');
    // Nome completo para leitores de tela: qual página e que abre em outra aba.
    expect(view).toHaveAccessibleName('Ver Sobre no site (abre em nova aba)');
    expect(view).toHaveAttribute('target', '_blank');

    const draft = screen.getByText('Privacidade').closest('li') as HTMLElement;
    expect(within(draft).getByText('Rascunho')).toBeInTheDocument();
    expect(within(draft).queryByRole('link', { name: /Ver/ })).not.toBeInTheDocument();
    expect(within(draft).getByRole('link', { name: /Editar/ })).toHaveAttribute(
      'href',
      '/admin/paginas/p2',
    );
    expect(screen.getByRole('link', { name: /Nova página/ })).toHaveAttribute(
      'href',
      '/admin/paginas/nova',
    );
  });

  it('exclui depois de confirmar, mandando a versão', async () => {
    (adminFetch as jest.Mock).mockResolvedValue(undefined);
    render(<PagesTable pages={pages} />);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Sobre' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/\/about passa a mostrar a página 404/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Excluir página/ }));

    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled());
    expect(adminFetch).toHaveBeenCalledWith('/api/admin/pages/p1?version=3', { method: 'DELETE' });
    expect(toast.success).toHaveBeenCalledWith('“Sobre” foi excluída.');
  });

  it('lista vazia', () => {
    render(<PagesTable pages={[]} />);
    expect(screen.getByText('Nenhuma página ainda.')).toBeInTheDocument();
  });
});
