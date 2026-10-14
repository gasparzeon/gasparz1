import { requireAdminPage } from '@/lib/auth/session';
import { listCommentsForAdmin } from '@/lib/comments/service';
import { CommentsTable } from '@/components/admin/comments-table';
import { NoPermission } from '@/components/admin/no-permission';

import CommentsPage from '../page';

// Página servidora: mocks na sessão e no serviço, JSX inspecionado direto.
jest.mock('@/lib/auth/session', () => ({
  requireAdminPage: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/comments/service', () => ({ listCommentsForAdmin: jest.fn() }));
jest.mock('@/components/admin/comments-table', () => ({ CommentsTable: jest.fn(() => null) }));

const sessionFor = (role: string) => ({
  user: { id: 'u1', username: 'x', name: 'X', role, avatarUrl: '' },
  sid: 's1',
  scope: 'posts:write media:write',
  expiresAt: 0,
});

const comment = {
  id: 'c1',
  body: 'Texto',
  status: 'visible',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  moderatedAt: null,
  moderatedBy: null,
  postSlug: 'p',
  postTitle: 'P',
  author: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('/admin/comentarios', () => {
  it('leitor e autor veem "Sem permissão" e nada é listado', async () => {
    for (const role of ['reader', 'author']) {
      (requireAdminPage as jest.Mock).mockResolvedValue(sessionFor(role));
      const element = await CommentsPage();
      expect(element.type).toBe(NoPermission);
      expect(element.props).toMatchObject({ message: 'Só editores moderam comentários.' });
    }
    expect(listCommentsForAdmin).not.toHaveBeenCalled();
    expect(CommentsTable).not.toHaveBeenCalled();
  });

  it('editor recebe a lista e passa para a tabela', async () => {
    (requireAdminPage as jest.Mock).mockResolvedValue(sessionFor('editor'));
    (listCommentsForAdmin as jest.Mock).mockResolvedValue([comment]);

    const element = await CommentsPage();
    // O <main> é do layout raiz; a página é um bloco dentro dele.
    expect(element.type).toBe('div');
    expect(listCommentsForAdmin).toHaveBeenCalledWith({ id: 'u1', role: 'editor' });
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];
    const table = children.find(
      (child: { type?: unknown }) => child && child.type === CommentsTable,
    );
    expect(table.props).toEqual({ comments: [comment] });
  });
});
