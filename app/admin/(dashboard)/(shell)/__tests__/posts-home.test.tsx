import { requireAdminPage } from '@/lib/auth/session';
import { ReaderLanding } from '@/components/admin/reader-landing';

import AdminPostsPage from '../page';

// Ramo do leitor na home do painel (o resto da página usa os testes dos
// componentes e serviços).
jest.mock('@/lib/auth/session', () => ({
  requireAdminPage: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/cms/posts', () => ({ listPostsForAdmin: jest.fn() }));
jest.mock('@/lib/cms/media', () => ({ getMediaMode: jest.fn(() => 'local') }));
jest.mock('@/lib/db', () => ({ databaseKind: jest.fn(() => 'postgres') }));

describe('/admin para leitor', () => {
  it('cai na tela do leitor, sem listar posts', async () => {
    (requireAdminPage as jest.Mock).mockResolvedValue({
      user: { id: 'u1', username: 'leitor', name: 'Leitor Silva', role: 'reader', avatarUrl: '' },
    });

    const { listPostsForAdmin } = jest.requireMock('@/lib/cms/posts');
    const element = await AdminPostsPage();
    expect(element.type).toBe(ReaderLanding);
    expect(element.props).toMatchObject({ name: 'Leitor Silva' });
    expect(listPostsForAdmin).not.toHaveBeenCalled();
  });
});
