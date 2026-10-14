import { NextRequest } from 'next/server';

import { authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';
import { DEFAULT_PAGES } from '@/lib/site/default-pages';
import {
  PageError,
  createPage,
  deletePage,
  getPageForEditor,
  listPagesForAdmin,
  updatePage,
} from '@/lib/site/pages';
import { DEFAULT_SITE_SETTINGS } from '@/lib/site/schema';
import { SiteError, getSiteSettingsForAdmin, saveSiteSettings } from '@/lib/site/service';

import { DELETE as removePage, GET as readPage, PUT as savePage } from '../pages/[id]/route';
import { GET as listPages, POST as newPage } from '../pages/route';
import { GET as readSite, PUT as saveSite } from '../site/route';

// adminRoute real; sessão e serviços mockados.
jest.mock('@/lib/auth/session', () => ({
  authenticateRequest: jest.fn(),
  isSameOriginRequest: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/site/service', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return {
    SiteError: class SiteError extends StatusError {},
    getSiteSettingsForAdmin: jest.fn(),
    saveSiteSettings: jest.fn(),
  };
});
jest.mock('@/lib/site/pages', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return {
    PageError: class PageError extends StatusError {},
    listPagesForAdmin: jest.fn(),
    createPage: jest.fn(),
    getPageForEditor: jest.fn(),
    updatePage: jest.fn(),
    deletePage: jest.fn(),
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
jest.mock('@/lib/users/service', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { UserError: class UserError extends StatusError {} };
});
jest.mock('@/lib/db', () => ({ DatabaseConfigError: class DatabaseConfigError extends Error {} }));

const ID = '0b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';
const actor = { id: 'a1', role: 'admin' };
const session = {
  user: { ...actor, username: 'admin', name: 'Admin', avatarUrl: '' },
  sid: 's1',
  scope: 'posts:write media:write',
  expiresAt: 0,
};

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
  (authenticateRequest as jest.Mock).mockResolvedValue({ session, viaCookie: true });
  (isSameOriginRequest as jest.Mock).mockReturnValue(true);
});

describe('/api/admin/site', () => {
  it('GET devolve as configurações e a versão', async () => {
    (getSiteSettingsForAdmin as jest.Mock).mockResolvedValue({
      settings: DEFAULT_SITE_SETTINGS,
      updatedAt: null,
    });
    expect(await parse(await readSite(request('/api/admin/site'), {}))).toEqual({
      status: 200,
      body: { settings: DEFAULT_SITE_SETTINGS, updatedAt: null },
    });
    expect(getSiteSettingsForAdmin).toHaveBeenCalledWith(actor);
  });

  it('PUT valida e salva com a versão carregada', async () => {
    (saveSiteSettings as jest.Mock).mockResolvedValue({
      settings: DEFAULT_SITE_SETTINGS,
      updatedAt: '2026-10-13T10:00:00.000Z',
    });
    const response = await saveSite(
      request('/api/admin/site', 'PUT', {
        settings: DEFAULT_SITE_SETTINGS,
        expectedUpdatedAt: '2026-10-13T09:00:00.000Z',
      }),
      {},
    );
    expect(response.status).toBe(200);
    expect(saveSiteSettings).toHaveBeenCalledWith(
      actor,
      DEFAULT_SITE_SETTINGS,
      '2026-10-13T09:00:00.000Z',
    );
  });

  it('PUT com link perigoso no menu → 400 e nada é salvo', async () => {
    const settings = structuredClone(DEFAULT_SITE_SETTINGS);
    settings.navigation.links[0].href = 'javascript:alert(1)';
    const { status, body } = await parse(
      await saveSite(request('/api/admin/site', 'PUT', { settings, expectedUpdatedAt: null }), {}),
    );
    expect(status).toBe(400);
    expect(body.message).toMatch(/navigation\.links\.0\.href/);
    expect(saveSiteSettings).not.toHaveBeenCalled();
  });

  it('traduz os erros do serviço (403 sem permissão, 409 conflito)', async () => {
    (getSiteSettingsForAdmin as jest.Mock).mockRejectedValue(
      new SiteError('Só administradores alteram o site.', 403, 'forbidden'),
    );
    expect(await parse(await readSite(request('/api/admin/site'), {}))).toEqual({
      status: 403,
      body: { error: 'forbidden', message: 'Só administradores alteram o site.' },
    });

    (saveSiteSettings as jest.Mock).mockRejectedValue(
      new SiteError('Outra pessoa salvou.', 409, 'conflict'),
    );
    const conflict = await saveSite(
      request('/api/admin/site', 'PUT', {
        settings: DEFAULT_SITE_SETTINGS,
        expectedUpdatedAt: null,
      }),
      {},
    );
    expect(conflict.status).toBe(409);
  });
});

describe('/api/admin/pages', () => {
  const page = DEFAULT_PAGES[0];

  it('lista e cria (201)', async () => {
    (listPagesForAdmin as jest.Mock).mockResolvedValue([{ id: ID, slug: 'about' }]);
    expect((await parse(await listPages(request('/api/admin/pages'), {}))).body).toEqual({
      pages: [{ id: ID, slug: 'about' }],
    });

    (createPage as jest.Mock).mockResolvedValue({ id: ID, slug: 'about' });
    const created = await newPage(
      request('/api/admin/pages', 'POST', { page, status: 'published', expectedVersion: null }),
      {},
    );
    expect(created.status).toBe(201);
    expect(createPage).toHaveBeenCalledWith(actor, page, 'published');
  });

  it('recusa endereço do sistema e bloco inválido antes do serviço', async () => {
    for (const invalid of [
      { ...page, slug: 'admin' },
      { ...page, blocks: [{ id: 'x', type: 'script', code: 'alert(1)' }] },
    ]) {
      const response = await newPage(
        request('/api/admin/pages', 'POST', {
          page: invalid,
          status: 'draft',
          expectedVersion: null,
        }),
        {},
      );
      expect(response.status).toBe(400);
    }
    expect(createPage).not.toHaveBeenCalled();
  });

  it('endereço já usado → 409 do serviço', async () => {
    (createPage as jest.Mock).mockRejectedValue(
      new PageError('Já existe uma página com esse endereço.', 409, 'exists'),
    );
    const { status, body } = await parse(
      await newPage(
        request('/api/admin/pages', 'POST', { page, status: 'draft', expectedVersion: null }),
        {},
      ),
    );
    expect(status).toBe(409);
    expect(body.error).toBe('exists');
  });

  it('GET/PUT/DELETE de uma página, com versão obrigatória', async () => {
    (getPageForEditor as jest.Mock).mockResolvedValue({ id: ID });
    expect((await readPage(request(`/api/admin/pages/${ID}`), params(ID))).status).toBe(200);
    expect(getPageForEditor).toHaveBeenCalledWith(actor, ID);

    const noVersion = await savePage(
      request(`/api/admin/pages/${ID}`, 'PUT', { page, status: 'draft', expectedVersion: null }),
      params(ID),
    );
    expect(noVersion.status).toBe(400);

    (updatePage as jest.Mock).mockResolvedValue({ id: ID, version: 4 });
    await savePage(
      request(`/api/admin/pages/${ID}`, 'PUT', { page, status: 'published', expectedVersion: 3 }),
      params(ID),
    );
    expect(updatePage).toHaveBeenCalledWith(actor, ID, page, 'published', 3);

    expect((await removePage(request(`/api/admin/pages/${ID}`, 'DELETE'), params(ID))).status).toBe(
      400,
    );
    const removed = await removePage(
      request(`/api/admin/pages/${ID}?version=3`, 'DELETE'),
      params(ID),
    );
    expect(removed.status).toBe(204);
    expect(deletePage).toHaveBeenCalledWith(actor, ID, 3);
  });

  it('sem sessão → 401', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({ session: null, viaCookie: true });
    expect((await listPages(request('/api/admin/pages'), {})).status).toBe(401);
  });
});
