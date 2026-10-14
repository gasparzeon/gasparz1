import { closeDb, createUser, resetDb } from '@/test/helpers/db';

import { DEFAULT_PAGES } from '../default-pages';
import {
  createPage,
  deletePage,
  getPageForEditor,
  getPublishedPage,
  listPagesForAdmin,
  listPublishedPages,
  updatePage,
} from '../pages';

// Páginas contra Postgres de verdade (PGlite): SQL, endereço único e versões.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const [about, support] = DEFAULT_PAGES;
let admin: { id: string; role: 'admin' };

beforeEach(async () => {
  await resetDb();
  const user = await createUser({ username: 'admin', name: 'Admin', role: 'admin' });
  admin = { id: user.id, role: 'admin' };
});

afterAll(async () => {
  await closeDb();
});

it('cria, edita, publica e apaga uma página', async () => {
  const created = await createPage(admin, about, 'draft');
  expect(created).toMatchObject({
    slug: 'about',
    status: 'draft',
    version: 1,
    updatedBy: { name: 'Admin' },
  });
  expect(created.blocks).toEqual(about.blocks);
  await expect(getPublishedPage('about')).resolves.toBeNull();

  const published = await updatePage(
    admin,
    created.id,
    { ...about, title: 'Quem somos' },
    'published',
    1,
  );
  expect(published).toMatchObject({ title: 'Quem somos', status: 'published', version: 2 });
  await expect(getPublishedPage('about')).resolves.toMatchObject({ title: 'Quem somos' });

  await deletePage(admin, created.id, 2);
  await expect(getPageForEditor(admin, created.id)).rejects.toMatchObject({ status: 404 });
});

it('não deixa duas páginas com o mesmo endereço', async () => {
  await createPage(admin, about, 'published');
  await expect(createPage(admin, { ...support, slug: 'about' }, 'draft')).rejects.toMatchObject({
    status: 409,
    code: 'exists',
  });

  const other = await createPage(admin, support, 'draft');
  await expect(
    updatePage(admin, other.id, { ...support, slug: 'about' }, 'draft', 1),
  ).rejects.toMatchObject({
    code: 'exists',
  });
});

it('edição com versão antiga é recusada (outra pessoa salvou antes)', async () => {
  const page = await createPage(admin, about, 'draft');
  await updatePage(admin, page.id, about, 'draft', 1);
  await expect(updatePage(admin, page.id, about, 'draft', 1)).rejects.toMatchObject({
    code: 'conflict',
  });
  await expect(deletePage(admin, page.id, 1)).rejects.toMatchObject({ code: 'conflict' });
});

it('lista para o painel (por título) e só as publicadas para o site', async () => {
  await createPage(admin, support, 'draft');
  await createPage(admin, about, 'published');

  const list = await listPagesForAdmin(admin);
  expect(list.map((page) => [page.title, page.status])).toEqual([
    ['Apoie', 'draft'],
    ['Sobre', 'published'],
  ]);
  await expect(listPublishedPages()).resolves.toEqual([
    { slug: 'about', updatedAt: expect.any(String) },
  ]);
});
