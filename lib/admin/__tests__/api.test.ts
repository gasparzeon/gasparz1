import { NextRequest } from 'next/server';

import { authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';
import { adminRoute, json } from '@/lib/admin/api';

jest.mock('@/lib/auth/session', () => ({
  authenticateRequest: jest.fn(),
  isSameOriginRequest: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));

const sessionFor = (role: string) => ({
  user: { id: 'u1', username: 'x', name: 'X', role, avatarUrl: '' },
  sid: 's1',
  scope: 'posts:write media:write',
  expiresAt: 0,
});
const get = (role: string | null) => {
  (authenticateRequest as jest.Mock).mockResolvedValue({
    session: role ? sessionFor(role) : null,
    viaCookie: true,
  });
  (isSameOriginRequest as jest.Mock).mockReturnValue(true);
  const handler = adminRoute('posts:write', async (_request, _context, { actor }) =>
    json({ role: actor.role }),
  );
  return handler(new NextRequest('http://localhost/api/admin/x'), {});
};

describe('adminRoute: leitor fora do painel', () => {
  it('leitor recebe 403 nas rotas do painel', async () => {
    const response = await get('reader');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'forbidden' });
  });

  it.each(['contributor', 'author', 'editor', 'admin', 'owner'])('%s passa', async (role) => {
    const response = await get(role);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role });
  });

  it('perfil (allowReader) aceita leitor', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({
      session: sessionFor('reader'),
      viaCookie: true,
    });
    (isSameOriginRequest as jest.Mock).mockReturnValue(true);
    const handler = adminRoute(
      'posts:write',
      async (_request, _context, { actor }) => json({ role: actor.role }),
      { allowReader: true },
    );
    const response = await handler(new NextRequest('http://localhost/api/admin/me'), {});
    expect(response.status).toBe(200);
  });

  it('sem sessão continua 401', async () => {
    const response = await get(null);
    expect(response.status).toBe(401);
  });
});
