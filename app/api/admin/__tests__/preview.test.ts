import { NextRequest } from 'next/server';

import { authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';
import { markdownToHast } from '@/lib/markdown/pipeline';
import { readmeToHast } from '@/lib/markdown/readme';

import { POST } from '../preview/route';

// adminRoute real; sessão e os dois pipelines de Markdown mockados.
jest.mock('@/lib/auth/session', () => ({
  authenticateRequest: jest.fn(),
  isSameOriginRequest: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/markdown/pipeline', () => ({
  markdownToHast: jest.fn(async () => ({ type: 'root', children: [], data: { post: true } })),
  stripPositions: (tree: unknown) => tree,
}));
jest.mock('@/lib/markdown/readme', () => ({
  readmeToHast: jest.fn(async () => ({ type: 'root', children: [] })),
}));
jest.mock('@/lib/users/service', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { UserError: class UserError extends StatusError {} };
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

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  (authenticateRequest as jest.Mock).mockResolvedValue({
    session: sessionOf('owner'),
    viaCookie: true,
  });
  (isSameOriginRequest as jest.Mock).mockReturnValue(true);
});

describe('/api/admin/preview', () => {
  it('sem "kind", usa o Markdown completo dos posts', async () => {
    const response = await POST(request({ content: '# Post' }), {});
    expect(response.status).toBe(200);
    expect(markdownToHast).toHaveBeenCalledWith('# Post');
    expect(readmeToHast).not.toHaveBeenCalled();
  });

  it('kind "readme" usa o Markdown restrito do README', async () => {
    const response = await POST(request({ content: '# Oi', kind: 'readme' }), {});
    expect(response.status).toBe(200);
    expect(readmeToHast).toHaveBeenCalledWith('# Oi');
    expect(markdownToHast).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ tree: { type: 'root', children: [] } });
  });

  it('leitor também pode ver a prévia do próprio README', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({
      session: sessionOf('reader'),
      viaCookie: true,
    });
    expect((await POST(request({ content: 'oi', kind: 'readme' }), {})).status).toBe(200);
  });

  it('tipo desconhecido → 400', async () => {
    expect((await POST(request({ content: 'oi', kind: 'html' }), {})).status).toBe(400);
  });
});
