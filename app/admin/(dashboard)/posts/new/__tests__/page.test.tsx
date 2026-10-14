import { requireAdminPage } from '@/lib/auth/session';
import { ReaderLanding } from '@/components/admin/reader-landing';

import NewPostPage from '../page';

jest.mock('@/lib/auth/session', () => ({
  requireAdminPage: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/cms/posts', () => ({ listTags: jest.fn(async () => []) }));
jest.mock('@/lib/users/service', () => ({ listActiveAuthors: jest.fn(async () => []) }));
jest.mock('@/lib/cms/media', () => ({ getMediaMode: jest.fn(() => 'local') }));

describe('/admin/posts/new para leitor', () => {
  it('cai na tela do leitor, sem buscar tags ou autores', async () => {
    (requireAdminPage as jest.Mock).mockResolvedValue({
      user: { id: 'u1', username: 'leitor', name: 'Leitor', role: 'reader', avatarUrl: '' },
    });

    const element = await NewPostPage();
    expect(element.type).toBe(ReaderLanding);

    const { listTags } = jest.requireMock('@/lib/cms/posts');
    const { listActiveAuthors } = jest.requireMock('@/lib/users/service');
    expect(listTags).not.toHaveBeenCalled();
    expect(listActiveAuthors).not.toHaveBeenCalled();
  });
});
