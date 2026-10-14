/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { listComments } from '@/lib/comments/service';

import { Comments } from '../comments';
import { CommentsSection } from '../comments-client';

jest.mock('@/lib/comments/service', () => ({ listComments: jest.fn() }));
jest.mock('../comments-client', () => ({ CommentsSection: jest.fn(() => null) }));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const config = { enabled: true, title: 'Comentários' };
const comment = {
  id: 'c1',
  body: 'Ótimo!',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  author: { id: 'u1', name: 'Leitora', username: 'leitora', avatarUrl: '' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (listComments as jest.Mock).mockResolvedValue({ post: { slug: 'p', title: 'P' }, comments: [] });
});

describe('<Comments /> (servidor, página estática)', () => {
  it('desligado não renderiza nada nem busca', async () => {
    const { container } = render(
      await Comments({ postSlug: 'p', config: { ...config, enabled: false } }),
    );
    expect(container).toBeEmptyDOMElement();
    expect(listComments).not.toHaveBeenCalled();
  });

  it('entrega a lista inicial para a seção interativa, sem sessão no HTML', async () => {
    (listComments as jest.Mock).mockResolvedValue({
      post: { slug: 'p', title: 'P' },
      comments: [comment],
    });
    render(await Comments({ postSlug: 'p', config }));

    expect(listComments).toHaveBeenCalledWith('p');
    expect(CommentsSection).toHaveBeenCalledWith(
      { postSlug: 'p', title: 'Comentários', initial: [comment] },
      undefined,
    );
  });

  it('título vazio usa o padrão e sem JS o convite continua', async () => {
    render(await Comments({ postSlug: 'p', config: { enabled: true, title: '' } }));
    expect(CommentsSection).toHaveBeenCalledWith(
      { postSlug: 'p', title: 'Comentários', initial: [] },
      undefined,
    );
    // O cliente React esvazia <noscript>: confere no HTML que o servidor gera.
    const html = renderToString(await Comments({ postSlug: 'p', config }));
    expect(html).toContain('/api/auth/login?returnTo=%2Fposts%2Fp');
    expect(html).toContain('/admin/cadastro');
  });
});
