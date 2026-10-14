import { NextRequest } from 'next/server';

import { authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';
import {
  PostError,
  createPost,
  deletePost,
  getPostForEditor,
  listPostsForAdmin,
  updatePost,
} from '@/lib/cms/posts';
import { markdownToHast } from '@/lib/markdown/pipeline';

import { POST as preview } from '../preview/route';
import { GET as list, POST as create } from '../posts/route';
import { DELETE as remove, GET as read, PUT as update } from '../posts/[id]/route';

// As rotas passam pelo adminRoute de verdade (autenticação, escopo, CSRF e
// tradução de erros); sessão e serviços são mocks.
jest.mock('@/lib/auth/session', () => ({
  authenticateRequest: jest.fn(),
  isSameOriginRequest: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/cms/posts', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return {
    PostError: class PostError extends StatusError {},
    createPost: jest.fn(),
    listPostsForAdmin: jest.fn(),
    getPostForEditor: jest.fn(),
    updatePost: jest.fn(),
    deletePost: jest.fn(),
  };
});
jest.mock('@/lib/cms/media', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { MediaError: class MediaError extends StatusError {} };
});
jest.mock('@/lib/users/service', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { UserError: class UserError extends StatusError {} };
});
jest.mock('@/lib/db', () => ({ DatabaseConfigError: class DatabaseConfigError extends Error {} }));
// Só o stripPositions real interessa; o Shiki (carregado em segundo plano pelo
// rehype-pretty-code) fica de fora para não sobreviver ao fim do teste.
jest.mock('rehype-pretty-code', () => () => () => undefined);
jest.mock('@/lib/markdown/pipeline', () => ({
  ...jest.requireActual('@/lib/markdown/pipeline'),
  markdownToHast: jest.fn(),
}));

const mockAuth = authenticateRequest as jest.Mock;
const actor = { id: 'u1', role: 'author' };
const session = {
  user: { ...actor, username: 'ana', name: 'Ana', avatarUrl: '' },
  sid: 's1',
  scope: 'posts:write media:write',
  expiresAt: 0,
};

const post = {
  slug: 'meu-post',
  title: 'Meu post',
  publishedAt: '2026-10-12',
  content: '# Olá\n\n![Foto](/uploads/2026/10/foto.webp "Legenda")',
};

function request(url: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function parse(response: Response) {
  return { status: response.status, body: await response.json().catch(() => null) };
}

beforeEach(() => {
  mockAuth.mockResolvedValue({ session, viaCookie: true });
  (isSameOriginRequest as jest.Mock).mockReturnValue(true);
});

describe('GET /api/admin/posts', () => {
  it('lista os posts do painel; ?mine=1 filtra os da pessoa', async () => {
    (listPostsForAdmin as jest.Mock).mockResolvedValue([{ id: 'p1' }]);

    expect(await parse(await list(request('/api/admin/posts'), {}))).toEqual({
      status: 200,
      body: { posts: [{ id: 'p1' }] },
    });
    await list(request('/api/admin/posts?mine=1'), {});

    expect(listPostsForAdmin).toHaveBeenNthCalledWith(1, actor, { onlyMine: false });
    expect(listPostsForAdmin).toHaveBeenNthCalledWith(2, actor, { onlyMine: true });
  });

  it('sem sessão responde 401 e não consulta nada', async () => {
    mockAuth.mockResolvedValue({ session: null, viaCookie: true });
    expect((await list(request('/api/admin/posts'), {})).status).toBe(401);
    expect(listPostsForAdmin).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/posts', () => {
  it('cria com os valores padrão preenchidos e devolve 201', async () => {
    (createPost as jest.Mock).mockResolvedValue({ id: 'p1', slug: 'meu-post' });

    const { status, body } = await parse(
      await create(
        request('/api/admin/posts', 'POST', { post, status: 'draft', expectedVersion: null }),
        {},
      ),
    );

    expect(status).toBe(201);
    expect(body.post).toEqual({ id: 'p1', slug: 'meu-post' });
    expect(createPost).toHaveBeenCalledWith(
      actor,
      { ...post, excerpt: '', updatedAt: '', tags: [], section: '', coverImage: '' },
      'draft',
    );
  });

  it('remove tags repetidas e aceita capa local ou https', async () => {
    (createPost as jest.Mock).mockResolvedValue({ id: 'p1' });
    await create(
      request('/api/admin/posts', 'POST', {
        post: { ...post, tags: ['ia', 'ia', 'mac'], coverImage: '/uploads/2026/10/capa.png' },
        status: 'published',
        expectedVersion: null,
      }),
      {},
    );
    expect((createPost as jest.Mock).mock.calls[0][1]).toMatchObject({
      tags: ['ia', 'mac'],
      coverImage: '/uploads/2026/10/capa.png',
    });
  });

  it.each([
    ['slug com acento', { ...post, slug: 'meu-pôst' }, /slug/],
    ['data fora do formato', { ...post, publishedAt: '12/10/2026' }, /publishedAt/],
    ['capa javascript:', { ...post, coverImage: 'javascript:alert(1)' }, /coverImage/],
    ['capa //outro-site', { ...post, coverImage: '//evil.example/a.png' }, /coverImage/],
    ['sem título', { ...post, title: '   ' }, /title/],
  ])('recusa %s com 400 e diz o campo', async (_label, invalid, field) => {
    const { status, body } = await parse(
      await create(
        request('/api/admin/posts', 'POST', {
          post: invalid,
          status: 'draft',
          expectedVersion: null,
        }),
        {},
      ),
    );
    expect(status).toBe(400);
    expect(body.error).toBe('validation');
    expect(body.message).toMatch(field);
    expect(createPost).not.toHaveBeenCalled();
  });

  it('recusa status desconhecido e JSON quebrado', async () => {
    expect(
      (
        await create(
          request('/api/admin/posts', 'POST', { post, status: 'secreto', expectedVersion: null }),
          {},
        )
      ).status,
    ).toBe(400);
    const broken = await parse(await create(request('/api/admin/posts', 'POST', '{"post":'), {}));
    expect(broken).toEqual({
      status: 400,
      body: { error: 'bad_request', message: 'JSON inválido.' },
    });
  });

  it('repassa os erros do serviço (ex.: slug em uso → 409)', async () => {
    (createPost as jest.Mock).mockRejectedValue(
      new PostError('Este endereço já está em uso.', 409, 'exists'),
    );
    expect(
      await parse(
        await create(
          request('/api/admin/posts', 'POST', { post, status: 'draft', expectedVersion: null }),
          {},
        ),
      ),
    ).toEqual({
      status: 409,
      body: { error: 'exists', message: 'Este endereço já está em uso.' },
    });
  });

  it('com cookie, recusa POST vindo de outro site (CSRF)', async () => {
    (isSameOriginRequest as jest.Mock).mockReturnValue(false);
    const response = await create(
      request('/api/admin/posts', 'POST', { post, status: 'draft', expectedVersion: null }),
      {},
    );
    expect(response.status).toBe(403);
    expect(createPost).not.toHaveBeenCalled();
  });
});

describe('/api/admin/posts/[id]', () => {
  it('GET abre o post para o editor', async () => {
    (getPostForEditor as jest.Mock).mockResolvedValue({ id: 'p1', version: 3 });
    expect(await parse(await read(request('/api/admin/posts/p1'), params('p1')))).toEqual({
      status: 200,
      body: { post: { id: 'p1', version: 3 } },
    });
    expect(getPostForEditor).toHaveBeenCalledWith(actor, 'p1');
  });

  it('PUT exige a versão carregada (evita sobrescrever a edição de outra pessoa)', async () => {
    const missing = await parse(
      await update(
        request('/api/admin/posts/p1', 'PUT', { post, status: 'draft', expectedVersion: null }),
        params('p1'),
      ),
    );
    expect(missing.status).toBe(400);
    expect(updatePost).not.toHaveBeenCalled();

    (updatePost as jest.Mock).mockResolvedValue({ id: 'p1', version: 4 });
    const saved = await parse(
      await update(
        request('/api/admin/posts/p1', 'PUT', { post, status: 'published', expectedVersion: 3 }),
        params('p1'),
      ),
    );
    expect(saved).toEqual({ status: 200, body: { post: { id: 'p1', version: 4 } } });
    expect(updatePost).toHaveBeenCalledWith(
      actor,
      'p1',
      expect.objectContaining({ slug: 'meu-post' }),
      'published',
      3,
    );
  });

  it('PUT com versão desatualizada vira 409 do serviço', async () => {
    (updatePost as jest.Mock).mockRejectedValue(
      new PostError('Alguém salvou antes.', 409, 'conflict'),
    );
    const response = await update(
      request('/api/admin/posts/p1', 'PUT', { post, status: 'draft', expectedVersion: 1 }),
      params('p1'),
    );
    expect(await parse(response)).toEqual({
      status: 409,
      body: { error: 'conflict', message: 'Alguém salvou antes.' },
    });
  });

  it('DELETE exige ?version= válido e responde 204', async () => {
    for (const query of ['', '?version=0', '?version=abc', '?version=1.5']) {
      expect(
        (await remove(request(`/api/admin/posts/p1${query}`, 'DELETE'), params('p1'))).status,
      ).toBe(400);
    }
    expect(deletePost).not.toHaveBeenCalled();

    const response = await remove(request('/api/admin/posts/p1?version=2', 'DELETE'), params('p1'));
    expect(response.status).toBe(204);
    expect(deletePost).toHaveBeenCalledWith(actor, 'p1', 2);
  });

  it('DELETE sem permissão vira 403 do serviço', async () => {
    (deletePost as jest.Mock).mockRejectedValue(new PostError('Sem permissão.', 403, 'forbidden'));
    expect(
      (await remove(request('/api/admin/posts/p1?version=2', 'DELETE'), params('p1'))).status,
    ).toBe(403);
  });
});

describe('POST /api/admin/preview', () => {
  it('renderiza com o pipeline do site e tira as posições da árvore', async () => {
    (markdownToHast as jest.Mock).mockResolvedValue({
      type: 'root',
      position: { start: { line: 1 } },
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          position: { start: { line: 1 } },
          children: [],
        },
      ],
    });

    const { status, body } = await parse(
      await preview(request('/api/admin/preview', 'POST', { content: 'Olá' }), {}),
    );

    expect(status).toBe(200);
    expect(markdownToHast).toHaveBeenCalledWith('Olá');
    expect(JSON.stringify(body.tree)).not.toContain('position');
    expect(body.tree.children[0].tagName).toBe('p');
  });

  it('limita o tamanho do texto', async () => {
    const response = await preview(
      request('/api/admin/preview', 'POST', { content: 'x'.repeat(1_000_001) }),
      {},
    );
    expect(response.status).toBe(400);
    expect(markdownToHast).not.toHaveBeenCalled();
  });
});
