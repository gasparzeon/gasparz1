/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import { adminFetch } from '@/lib/admin/client';
import type { ManagedComment } from '@/lib/comments/service';

import { CommentsTable } from '../comments-table';

jest.mock('@/lib/admin/client', () => ({
  adminFetch: jest.fn(),
  ApiError: class ApiError extends Error {},
}));
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

const mockFetch = adminFetch as jest.Mock;

const comment = (overrides: Partial<ManagedComment> = {}): ManagedComment => ({
  id: 'c1',
  body: 'Texto do comentário',
  status: 'visible',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  moderatedAt: null,
  moderatedBy: null,
  postSlug: 'meu-post',
  postTitle: 'Meu post',
  author: { id: 'u1', name: 'Leitora', username: 'leitora', avatarUrl: '' },
  ...overrides,
});

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({});
  mockRouter.refresh.mockClear();
});

describe('<CommentsTable />', () => {
  it('lista com status, post e autor; filtra ocultos', () => {
    render(
      <CommentsTable
        comments={[comment(), comment({ id: 'c2', body: 'Spam', status: 'hidden' })]}
      />,
    );
    expect(screen.getByText('Texto do comentário')).toBeInTheDocument();
    expect(screen.getByText('Visível')).toBeInTheDocument();
    expect(screen.getByText('Oculto')).toBeInTheDocument();
    const postLinks = screen.getAllByRole('link', { name: 'Meu post' });
    expect(postLinks).toHaveLength(2);
    expect(postLinks[0]).toHaveAttribute('href', '/posts/meu-post');

    fireEvent.click(screen.getByRole('button', { name: /Ocultos/ }));
    expect(screen.queryByText('Texto do comentário')).not.toBeInTheDocument();
    expect(screen.getByText('Spam')).toBeInTheDocument();
  });

  it('oculta e exibe de novo', async () => {
    render(<CommentsTable comments={[comment()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/comments/c1/visibility',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ status: 'hidden' });
    expect(toast.success).toHaveBeenCalledWith('Comentário ocultado.');
  });

  it('apaga depois de confirmar', async () => {
    render(<CommentsTable comments={[comment()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apagar comentário de Leitora' }));
    expect(mockFetch).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar' }));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/comments/c1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Comentário apagado.');
  });

  it('mostra quem moderou e quando', () => {
    render(
      <CommentsTable
        comments={[
          comment({
            status: 'hidden',
            moderatedBy: 'ed',
            moderatedAt: new Date('2026-10-03T10:00:00Z'),
          }),
        ]}
      />,
    );
    expect(screen.getByText(/moderado por @ed em/)).toBeInTheDocument();
  });
});
