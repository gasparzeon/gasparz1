import { NextRequest } from 'next/server';

import { authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';
import {
  CommentError,
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from '@/lib/comments/service';

import { GET as list, POST as create } from '../route';
import { DELETE as remove, PATCH as edit } from '../[id]/route';
import { POST as moderate } from '../[id]/visibility/route';

// Rotas reais; sessão e serviços mockados.
jest.mock('@/lib/auth/session', () => ({
  authenticateRequest: jest.fn(),
  isSameOriginRequest: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/comments/service', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return {
    CommentError: class CommentError extends StatusError {},
    commentBodySchema: jest.requireActual('@/lib/comments/service').commentBodySchema,
    visibilitySchema: jest.requireActual('@/lib/comments/service').visibilitySchema,
    listComments: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    setCommentVisibility: jest.fn(),
  };
});

const readerSession = (role = 'reader') => ({
  user: { id: 'u1', username: 'leitor', name: 'Leitor', avatarUrl: '', role },
  sid: 's1',
  scope: 'posts:write media:write',
  expiresAt: 0,
});

const request = (path: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const parse = async (response: Response) => ({
  status: response.status,
  body: await response.json().catch(() => null),
});

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateRequest as jest.Mock).mockResolvedValue({
    session: readerSession(),
    viaCookie: true,
  });
  (isSameOriginRequest as jest.Mock).mockReturnValue(true);
});

describe('GET /api/comments (público)', () => {
  it('lista sem sessão', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({ session: null, viaCookie: false });
    (listComments as jest.Mock).mockResolvedValue({ post: { slug: 'p' }, comments: [] });
    expect(await parse(await list(request('/api/comments?post=p')))).toEqual({
      status: 200,
      body: { post: { slug: 'p' }, comments: [] },
    });
  });

  it('post inexistente dá 404', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({ session: null, viaCookie: false });
    (listComments as jest.Mock).mockRejectedValue(new CommentError('Post não encontrado.', 404));
    expect((await parse(await list(request('/api/comments?post=sumido')))).status).toBe(404);
  });
});

describe('POST /api/comments', () => {
  it('sem sessão dá 401 e nada é criado', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({ session: null, viaCookie: false });
    expect(
      (await parse(await create(request('/api/comments', 'POST', { post: 'p', body: 'oi' }))))
        .status,
    ).toBe(401);
    expect(createComment).not.toHaveBeenCalled();
  });

  it('leitor cria (201) com o próprio id', async () => {
    (createComment as jest.Mock).mockResolvedValue({ id: 'c1', body: 'oi' });
    expect(
      await parse(await create(request('/api/comments', 'POST', { post: 'p', body: 'oi' }))),
    ).toEqual({ status: 201, body: { comment: { id: 'c1', body: 'oi' } } });
    expect(createComment).toHaveBeenCalledWith('u1', 'p', 'oi');
  });

  it('origem de outro site é recusada (CSRF)', async () => {
    (isSameOriginRequest as jest.Mock).mockReturnValue(false);
    expect(
      (await parse(await create(request('/api/comments', 'POST', { post: 'p', body: 'oi' }))))
        .status,
    ).toBe(403);
    expect(createComment).not.toHaveBeenCalled();
  });
});

describe('PATCH e DELETE /api/comments/[id]', () => {
  it('edita e apaga via serviço, com o id da URL', async () => {
    expect(
      (await edit(request('/api/comments/c1', 'PATCH', { body: 'novo' }), params('c1'))).status,
    ).toBe(204);
    expect(updateComment).toHaveBeenCalledWith('u1', 'c1', 'novo');

    expect((await remove(request('/api/comments/c1', 'DELETE'), params('c1'))).status).toBe(204);
    expect(deleteComment).toHaveBeenCalledWith({ id: 'u1', role: 'reader' }, 'c1');
  });

  it('erro do serviço vira o status certo', async () => {
    (updateComment as jest.Mock).mockRejectedValue(new CommentError('Proibido.', 403));
    expect(
      (await parse(await edit(request('/api/comments/c1', 'PATCH', { body: 'x' }), params('c1'))))
        .status,
    ).toBe(403);
  });
});

describe('POST /api/comments/[id]/visibility', () => {
  it('moderação passa status validado e ator', async () => {
    const { setCommentVisibility } = jest.requireMock('@/lib/comments/service');
    (authenticateRequest as jest.Mock).mockResolvedValue({
      session: readerSession('editor'),
      viaCookie: true,
    });
    expect(
      await parse(
        await moderate(
          request('/api/comments/c1/visibility', 'POST', { status: 'hidden' }),
          params('c1'),
        ),
      ),
    ).toEqual({ status: 200, body: { ok: true } });
    expect(setCommentVisibility).toHaveBeenCalledWith({ id: 'u1', role: 'editor' }, 'c1', 'hidden');
  });

  it('status inválido dá 400 sem moderar', async () => {
    const { setCommentVisibility } = jest.requireMock('@/lib/comments/service');
    expect(
      (
        await parse(
          await moderate(
            request('/api/comments/c1/visibility', 'POST', { status: 'some' }),
            params('c1'),
          ),
        )
      ).status,
    ).toBe(400);
    expect(setCommentVisibility).not.toHaveBeenCalled();
  });
});
