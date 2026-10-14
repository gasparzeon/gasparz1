import { requireAdminPage } from '@/lib/auth/session';
import { PostError, getPostForEditor } from '@/lib/cms/posts';
import { notFound } from 'next/navigation';

import EditPostPage from '../page';

jest.mock('@/lib/auth/session', () => ({
  requireAdminPage: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/cms/posts', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return {
    PostError: class PostError extends StatusError {},
    getPostForEditor: jest.fn(),
    listTags: jest.fn(async () => []),
  };
});
jest.mock('@/lib/users/service', () => ({ listActiveAuthors: jest.fn(async () => []) }));
jest.mock('@/lib/cms/media', () => ({ getMediaMode: jest.fn(() => 'local') }));
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const readerSession = {
  user: { id: 'u1', username: 'leitor', name: 'Leitor', role: 'reader', avatarUrl: '' },
};
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  (requireAdminPage as jest.Mock).mockResolvedValue(readerSession);
});

describe('/admin/posts/[id] sem permissão', () => {
  it('leitor vê "Sem permissão" com a mensagem do serviço', async () => {
    (getPostForEditor as jest.Mock).mockRejectedValue(
      new PostError('Você não pode editar este post.', 403),
    );

    const element = await EditPostPage(params('post-id'));
    expect(element.type).toBe('div');
    expect(JSON.stringify(element.props)).toContain('Sem permissão');
    expect(JSON.stringify(element.props)).toContain('Você não pode editar este post.');
  });

  it('post inexistente chama notFound', async () => {
    (getPostForEditor as jest.Mock).mockRejectedValue(new PostError('Post não encontrado.', 404));
    await expect(EditPostPage(params('sumido'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
