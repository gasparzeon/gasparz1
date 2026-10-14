import { authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';

import { commentErrorResponse, commentSession, requireSameOrigin } from '../http';
import { CommentError, commentBodySchema } from '../service';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/auth/rate-limit', () => ({ consumeCommentAttempt: jest.fn() }));
jest.mock('@/lib/auth/session', () => ({
  authenticateRequest: jest.fn(),
  isSameOriginRequest: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));

const session = {
  user: { id: 'u1', username: 'leitor', name: 'Leitor', avatarUrl: '', role: 'reader' },
  sid: 's1',
  scope: 'posts:write media:write',
  expiresAt: 0,
};
const req = () => new Request('http://localhost/api/comments');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('commentSession', () => {
  it('sem sessão lança 401 com convite para entrar', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({ session: null, viaCookie: false });
    const caught = await commentSession(req()).catch((error) => error);
    expect(caught).toBeInstanceOf(CommentError);
    expect(caught).toMatchObject({ status: 401, code: 'unauthorized' });
  });

  it('com sessão devolve ator (qualquer papel ativo, inclusive leitor)', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({ session, viaCookie: true });
    await expect(commentSession(req())).resolves.toEqual({
      session,
      actor: { id: 'u1', role: 'reader' },
      viaCookie: true,
    });
  });
});

describe('requireSameOrigin (CSRF)', () => {
  it('Bearer (sem cookie) não exige mesma origem', () => {
    expect(() => requireSameOrigin(req(), false)).not.toThrow();
  });

  it('via cookie exige mesma origem', () => {
    (isSameOriginRequest as jest.Mock).mockReturnValue(false);
    expect(() => requireSameOrigin(req(), true)).toThrow(expect.objectContaining({ status: 403 }));
    (isSameOriginRequest as jest.Mock).mockReturnValue(true);
    expect(() => requireSameOrigin(req(), true)).not.toThrow();
  });
});

describe('commentErrorResponse', () => {
  const parse = async (response: Response) => ({
    status: response.status,
    body: await response.json(),
  });

  it('CommentError vira código e status do serviço', async () => {
    await expect(
      parse(commentErrorResponse(new CommentError('Oculto.', 404, 'not_found'))),
    ).resolves.toEqual({ status: 404, body: { error: 'not_found', message: 'Oculto.' } });
  });

  it('validação do Zod vira 400 com a mensagem do campo', async () => {
    const result = commentBodySchema.safeParse('   ');
    expect(result.success).toBe(false);
    if (!result.success) {
      await expect(parse(commentErrorResponse(result.error))).resolves.toEqual({
        status: 400,
        body: { error: 'validation', message: 'Escreva um comentário.' },
      });
    }
  });

  it('JSON quebrado vira 400 bad_request', async () => {
    await expect(parse(commentErrorResponse(new SyntaxError('fim inesperado')))).resolves.toEqual({
      status: 400,
      body: { error: 'bad_request', message: 'JSON inválido.' },
    });
  });

  it('erro desconhecido vira 500 sem vazar detalhe', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(parse(commentErrorResponse(new Error('segredo')))).resolves.toEqual({
        status: 500,
        body: { error: 'internal', message: 'Erro inesperado no servidor.' },
      });
    } finally {
      error.mockRestore();
    }
  });
});
