import { revalidatePath } from 'next/cache';

import { getDb } from '@/lib/db';
import { createFakeDb, type FakeDb } from '@/test/helpers/fake-db';

import { DEFAULT_PAGES } from '../default-pages';
import * as pages from '../pages';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const ID = '0b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';
const admin = { id: 'a1', role: 'admin' as const };
const author = { id: 'u1', role: 'author' as const };
const about = DEFAULT_PAGES[0];

const row = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  slug: about.slug,
  title: about.title,
  description: about.description,
  blocks: about.blocks,
  showBackLink: false,
  status: 'published',
  updatedBy: 'a1',
  version: 3,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-12T00:00:00Z'),
  updaterName: 'Ana',
  ...overrides,
});

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  (getDb as jest.Mock).mockResolvedValue(fake.db);
});

describe('parseBlocks', () => {
  it('descarta blocos inválidos em vez de derrubar a página', () => {
    expect(
      pages.parseBlocks([
        { id: 'a', type: 'markdown', content: 'ok', boxed: false },
        { id: 'b', type: 'script', code: 'alert(1)' },
        'lixo',
      ]),
    ).toEqual([{ id: 'a', type: 'markdown', content: 'ok', boxed: false }]);
    expect(pages.parseBlocks(null)).toEqual([]);
  });
});

describe('permissões', () => {
  it('só administradores mexem nas páginas', async () => {
    await expect(pages.listPagesForAdmin(author)).rejects.toMatchObject({ status: 403 });
    await expect(pages.getPageForEditor(author, ID)).rejects.toMatchObject({ status: 403 });
    await expect(pages.createPage(author, about, 'draft')).rejects.toMatchObject({ status: 403 });
    await expect(pages.updatePage(author, ID, about, 'draft', 1)).rejects.toMatchObject({
      status: 403,
    });
    await expect(pages.deletePage(author, ID, 1)).rejects.toMatchObject({ status: 403 });
    expect(fake.calls).toHaveLength(0);
  });
});

describe('painel', () => {
  it('converte a linha do banco no documento do editor', async () => {
    fake.queue('select', [row()]);
    await expect(pages.getPageForEditor(admin, ID)).resolves.toEqual({
      id: ID,
      slug: 'about',
      title: 'Sobre',
      description: about.description,
      blocks: about.blocks,
      showBackLink: false,
      status: 'published',
      version: 3,
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: { id: 'a1', name: 'Ana' },
    });
  });

  it('id inválido ou inexistente → 404 (sem consultar com lixo)', async () => {
    await expect(pages.getPageForEditor(admin, 'nao-e-uuid')).rejects.toMatchObject({
      status: 404,
    });
    expect(fake.count('select')).toBe(0);
    fake.queue('select', []);
    await expect(pages.getPageForEditor(admin, ID)).rejects.toMatchObject({ status: 404 });
  });

  it('cria e regenera o site só quando publica', async () => {
    fake.queue('insert', [{ id: ID }]);
    fake.queue('select', [row({ status: 'draft' })]);
    await pages.createPage(admin, { ...about, slug: 'contato' }, 'draft');
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(fake.argsOf('insert', 'values')[0][0]).toMatchObject({
      slug: 'contato',
      status: 'draft',
      updatedBy: 'a1',
    });

    fake.queue('insert', [{ id: ID }]);
    fake.queue('select', [row()]);
    await pages.createPage(admin, { ...about, slug: 'contato-2' }, 'published');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('endereço repetido vira 409 com mensagem clara', async () => {
    fake.queue('insert', Object.assign(new Error('duplicate key'), { code: '23505' }));
    await expect(pages.createPage(admin, about, 'draft')).rejects.toMatchObject({
      status: 409,
      code: 'exists',
      message: 'Já existe uma página com esse endereço.',
    });
  });

  it('valida a página antes de gravar (endereço do sistema não passa)', async () => {
    await expect(pages.createPage(admin, { ...about, slug: 'admin' }, 'draft')).rejects.toThrow();
    expect(fake.count('insert')).toBe(0);
  });

  it('atualiza só se a versão bater (senão 409)', async () => {
    fake.queue('select', [row()]);
    fake.queue('update', []);
    await expect(pages.updatePage(admin, ID, about, 'published', 2)).rejects.toMatchObject({
      status: 409,
      code: 'conflict',
    });

    fake.queue('select', [row()]);
    fake.queue('update', [{ id: ID }]);
    fake.queue('select', [row({ version: 4 })]);
    await expect(pages.updatePage(admin, ID, about, 'published', 3)).resolves.toMatchObject({
      version: 4,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('apagar exige a versão e regenera o site se estava publicada', async () => {
    fake.queue('select', [row()]);
    fake.queue('delete', []);
    await expect(pages.deletePage(admin, ID, 1)).rejects.toMatchObject({ status: 409 });

    fake.queue('select', [row()]);
    fake.queue('delete', [{ id: ID }]);
    await pages.deletePage(admin, ID, 3);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});

describe('site público', () => {
  it('só entrega páginas publicadas', async () => {
    fake.queue('select', []);
    await expect(pages.getPublishedPage('rascunho')).resolves.toBeNull();
    fake.queue('select', [row()]);
    await expect(pages.getPublishedPage('about')).resolves.toMatchObject({ slug: 'about' });
  });

  it('lista as publicadas para o sitemap', async () => {
    fake.queue('select', [{ slug: 'about', updatedAt: new Date('2026-10-12T00:00:00Z') }]);
    await expect(pages.listPublishedPages()).resolves.toEqual([
      { slug: 'about', updatedAt: '2026-10-12T00:00:00.000Z' },
    ]);
  });
});
