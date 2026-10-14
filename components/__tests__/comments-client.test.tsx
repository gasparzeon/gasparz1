/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { adminFetch } from '@/lib/admin/client';
import type { CommentView } from '@/lib/comments/service';

import { CommentForm, CommentItem, CommentsSection } from '../comments-client';

jest.mock('@/lib/admin/client', () => ({
  adminFetch: jest.fn(),
  ApiError: class ApiError extends Error {},
}));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const mockFetch = adminFetch as jest.Mock;
const realFetch = global.fetch;

const comment = (overrides: Partial<CommentView> = {}): CommentView => ({
  id: 'c1',
  body: 'Ótimo post!',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  author: { id: 'u1', name: 'Leitora', username: 'leitora', avatarUrl: '' },
  ...overrides,
});

// GETs do navegador (identidade + lista); mutações vão pelo adminFetch.
const mockGet = (me: unknown, comments: CommentView[] = []) => {
  global.fetch = jest.fn(async (url: unknown) => {
    const path = String(url);
    if (path === '/api/admin/me') {
      return me === null
        ? { ok: false, status: 401, json: async () => null }
        : { ok: true, status: 200, json: async () => ({ profile: me }) };
    }
    return { ok: true, status: 200, json: async () => ({ comments }) };
  }) as unknown as typeof fetch;
};

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({});
});

afterEach(() => {
  global.fetch = realFetch;
});

const flush = () => waitFor(() => expect(global.fetch).toHaveBeenCalled());

describe('<CommentsSection />', () => {
  it('visitante vê a lista inicial e o convite (igual ao HTML estático)', async () => {
    mockGet(null, [comment()]);
    render(<CommentsSection postSlug="p" title="Comentários" initial={[comment()]} />);

    expect(screen.getByRole('heading', { name: /Comentários/ })).toBeInTheDocument();
    expect(screen.getByText('Ótimo post!')).toBeInTheDocument();
    await flush();
    expect(screen.getByRole('link', { name: 'Crie uma conta' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Deixe um comentário')).not.toBeInTheDocument();
  });

  it('logado vê o formulário e comentar recarrega a lista', async () => {
    mockGet({ id: 'u1', username: 'leitora', role: 'reader' }, [comment()]);
    render(<CommentsSection postSlug="p" title="Comentários" initial={[]} />);

    await waitFor(() => expect(screen.getByLabelText('Deixe um comentário')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Deixe um comentário'), {
      target: { value: 'Concordo!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/comments',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({
      post: 'p',
      body: 'Concordo!',
    });
    // Recarrega a lista pública depois de comentar.
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comments?post=p',
        expect.objectContaining({ cache: 'no-store' }),
      ),
    );
  });

  it('moderador vê Ocultar nos comentários alheios', async () => {
    mockGet({ id: 'u9', username: 'ed', role: 'editor' }, [comment()]);
    render(<CommentsSection postSlug="p" title="Comentários" initial={[comment()]} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ocultar' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('dono do comentário vê Editar só no seu e o contador acompanha a lista', async () => {
    const two = [
      comment(),
      comment({
        id: 'c2',
        body: 'Segundo',
        author: { id: 'u2', name: 'Outro', username: 'outro', avatarUrl: '' },
      }),
    ];
    mockGet({ id: 'u1', username: 'leitora', role: 'reader' }, two);
    render(<CommentsSection postSlug="p" title="Comentários" initial={two} />);

    expect(screen.getByRole('heading', { name: /Comentários/ })).toHaveTextContent('2');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(1);
  });
});

describe('<CommentForm />', () => {
  const noop = () => {};

  it('botão desabilitado com texto vazio e mostra erro do servidor', async () => {
    const { ApiError } = jest.requireMock('@/lib/admin/client');
    mockFetch.mockRejectedValue(new ApiError('Muitos comentários em pouco tempo.'));
    render(<CommentForm postSlug="p" onDone={noop} />);
    expect(screen.getByRole('button', { name: 'Comentar' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Deixe um comentário'), { target: { value: 'oi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Muitos comentários'));
  });

  it('sucesso limpa e avisa o pai', async () => {
    const onDone = jest.fn();
    render(<CommentForm postSlug="p" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Deixe um comentário'), { target: { value: 'oi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((screen.getByLabelText('Deixe um comentário') as HTMLTextAreaElement).value).toBe('');
  });
});

describe('<CommentItem />', () => {
  const noop = () => {};

  it('mostra autor, data e texto puro (sem HTML)', () => {
    render(
      <CommentItem
        comment={comment({ body: '<b>oi</b>' })}
        mine={false}
        canModerate={false}
        onDone={noop}
      />,
    );
    expect(screen.getByText('Leitora')).toBeInTheDocument();
    expect(screen.getByText('@leitora')).toBeInTheDocument();
    expect(screen.getByText('<b>oi</b>')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ocultar' })).not.toBeInTheDocument();
  });

  it('conta removida aparece sem autor', () => {
    render(
      <CommentItem
        comment={comment({ author: null })}
        mine={false}
        canModerate={false}
        onDone={noop}
      />,
    );
    expect(screen.getByText('Conta removida')).toBeInTheDocument();
  });

  it('dono edita e a lista é recarregada pelo pai', async () => {
    const onDone = jest.fn();
    render(<CommentItem comment={comment()} mine canModerate={false} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Editar comentário'), { target: { value: 'Editado!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/comments/c1',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('apagar pede confirmação antes', async () => {
    const onDone = jest.fn();
    render(<CommentItem comment={comment()} mine canModerate={false} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apagar' }));
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/comments/c1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('moderador esconde', async () => {
    const onDone = jest.fn();
    render(<CommentItem comment={comment()} mine={false} canModerate onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/comments/c1/visibility',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({ status: 'hidden' });
    expect(onDone).toHaveBeenCalled();
  });
});
