import { NextRequest } from 'next/server';

import { authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';
import { getProfile, updateProfile } from '@/lib/users/service';
import { profileSocialsSchema } from '@/lib/users/socials';

import { GET, PATCH } from '../me/route';

// adminRoute real; sessão e serviço de usuários mockados.
jest.mock('@/lib/auth/session', () => ({
  authenticateRequest: jest.fn(),
  isSameOriginRequest: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/users/service', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return {
    UserError: class UserError extends StatusError {},
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  };
});
jest.mock('@/lib/cms/posts', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { PostError: class PostError extends StatusError {} };
});
jest.mock('@/lib/cms/media', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { MediaError: class MediaError extends StatusError {} };
});
jest.mock('@/lib/site/service', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { SiteError: class SiteError extends StatusError {} };
});
jest.mock('@/lib/site/pages', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { PageError: class PageError extends StatusError {} };
});
jest.mock('@/lib/db', () => ({ DatabaseConfigError: class DatabaseConfigError extends Error {} }));

const sessionOf = (role: string) => ({
  user: { id: 'u1', role, username: 'gaspar', name: 'Gaspar', avatarUrl: '' },
  sid: 's1',
  scope: 'posts:write media:write',
  expiresAt: 0,
});

const request = (method = 'GET', body?: unknown) =>
  new NextRequest('http://localhost/api/admin/me', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const profile = {
  id: 'u1',
  name: 'Gaspar',
  username: 'gaspar',
  email: null,
  bio: '',
  avatarUrl: '',
  role: 'owner',
  socials: [{ network: 'x', handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' }],
};

beforeEach(() => {
  (authenticateRequest as jest.Mock).mockResolvedValue({
    session: sessionOf('owner'),
    viaCookie: true,
  });
  (isSameOriginRequest as jest.Mock).mockReturnValue(true);
  (getProfile as jest.Mock).mockResolvedValue(profile);
});

describe('/api/admin/me', () => {
  it('GET devolve o perfil com as redes', async () => {
    const response = await GET(request(), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile });
    expect(getProfile).toHaveBeenCalledWith('u1');
  });

  it('PATCH salva o perfil de quem está logado (nunca de outra pessoa)', async () => {
    const body = {
      name: 'Gaspar',
      username: 'gaspar',
      email: '',
      bio: '',
      avatarUrl: '',
      socials: [{ network: 'x', value: '@gasparzeon', label: '' }],
    };
    const response = await PATCH(request('PATCH', { ...body, id: 'outra-pessoa' }), {});
    expect(response.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining(body));
    expect(await response.json()).toEqual({ profile });
  });

  it('leitor também edita o próprio perfil', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({
      session: sessionOf('reader'),
      viaCookie: true,
    });
    expect((await PATCH(request('PATCH', {}), {})).status).toBe(200);
  });

  it('link inválido → 400 com a mensagem da rede', async () => {
    const invalid = profileSocialsSchema.safeParse([
      { network: 'instagram', value: 'https://evil.com/gaspar' },
    ]);
    (updateProfile as jest.Mock).mockRejectedValue(invalid.error);

    const response = await PATCH(request('PATCH', {}), {});
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/Esse link não é do Instagram/);
  });

  it('sem sessão → 401 e nada é salvo', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({ session: null, viaCookie: true });
    expect((await PATCH(request('PATCH', {}), {})).status).toBe(401);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('de outro site (CSRF) → recusado e nada é salvo', async () => {
    (isSameOriginRequest as jest.Mock).mockReturnValue(false);
    expect((await PATCH(request('PATCH', {}), {})).status).toBe(403);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
