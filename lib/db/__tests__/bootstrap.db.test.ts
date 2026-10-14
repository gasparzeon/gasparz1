import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';

import { pages, posts, settings, users } from '@/lib/db/schema';
import { closeDb, getDb, resetDb } from '@/test/helpers/db';
import { fastHash } from '@/test/helpers/password';

import { bootstrap, ensureOwner } from '../bootstrap';

let root: string;

beforeAll(async () => {
  // Posts .mdx de exemplo num diretório temporário (o import lê content/posts do cwd).
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'gaspar-bootstrap-'));
  await fs.mkdir(path.join(root, 'content/posts'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'content/posts/primeiro.mdx'),
    '---\ntitle: Primeiro\nexcerpt: Resumo\npublishedAt: 2026-01-02\ntags:\n  - ia\nsection: pesquisas\ndraft: false\n---\n\nTexto.\n',
  );
  await fs.writeFile(
    path.join(root, 'content/posts/rascunho.mdx'),
    "---\ntitle: Rascunho\npublishedAt: '2026-02-03'\ndraft: true\n---\nEm andamento.\n",
  );
  await fs.writeFile(path.join(root, 'content/posts/Inválido.mdx'), '---\ntitle: x\n---\n');
});

beforeEach(async () => {
  await resetDb();
  jest.spyOn(process, 'cwd').mockReturnValue(root);
  process.env.ADMIN_USERNAME = 'gaspar';
  process.env.ADMIN_PASSWORD_HASH = fastHash('senha-do-dono-123');
  delete process.env.SKIP_LEGACY_IMPORT;
});

afterAll(async () => {
  process.env.SKIP_LEGACY_IMPORT = '1';
  await closeDb();
  await fs.rm(root, { recursive: true, force: true });
});

describe('ensureOwner', () => {
  it('cria o dono a partir de ADMIN_USERNAME/ADMIN_PASSWORD_HASH uma única vez', async () => {
    const db = await getDb();
    const first = await ensureOwner(db);
    const second = await ensureOwner(db);

    expect(first).toBe(second);
    const owners = await db.select().from(users).where(eq(users.role, 'owner'));
    expect(owners).toHaveLength(1);
    expect(owners[0]).toMatchObject({ username: 'gaspar', status: 'active' });
  });

  it('não cria nada sem as variáveis', async () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    await expect(ensureOwner(await getDb())).resolves.toBeNull();
  });

  it('o banco garante no máximo um dono', async () => {
    const db = await getDb();
    await ensureOwner(db);
    await expect(
      db
        .insert(users)
        .values({ username: 'outro', name: 'Outro', role: 'owner', status: 'active' }),
    ).rejects.toThrow();
  });
});

describe('importação dos posts antigos (.mdx)', () => {
  it('importa uma vez, preservando status, datas e tags', async () => {
    const db = await getDb();
    await bootstrap(db);
    await bootstrap(db);

    const rows = await db.select().from(posts).orderBy(posts.slug);
    expect(rows.map((row) => [row.slug, row.status, row.publishedAt])).toEqual([
      ['primeiro', 'published', '2026-01-02'],
      ['rascunho', 'draft', '2026-02-03'],
    ]);
    expect(rows[0]).toMatchObject({
      tags: ['ia'],
      section: 'pesquisas',
      excerpt: 'Resumo',
      content: 'Texto.\n',
    });
    // Sem seção no frontmatter (ou com uma inválida), fica sem seção.
    expect(rows[1].section).toBeNull();

    const [mark] = await db.select().from(settings).where(eq(settings.key, 'legacy_posts_import'));
    expect(mark.value).toMatchObject({ count: 2 });
  });

  it('não reimporta depois que o dono apaga os posts', async () => {
    const db = await getDb();
    await bootstrap(db);
    await db.delete(posts);
    await bootstrap(db);
    await expect(db.select().from(posts)).resolves.toHaveLength(0);
  });
});

describe('páginas iniciais (Sobre e Apoie)', () => {
  it('cria as páginas publicadas uma única vez', async () => {
    const db = await getDb();
    await bootstrap(db);
    await bootstrap(db);

    const rows = await db.select().from(pages).orderBy(pages.slug);
    expect(rows.map((row) => [row.slug, row.status])).toEqual([
      ['about', 'published'],
      ['support', 'published'],
    ]);
    expect(rows[1].blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'hero' })]),
    );
  });

  it('não recria uma página que o admin apagou', async () => {
    const db = await getDb();
    await bootstrap(db);
    await db.delete(pages).where(eq(pages.slug, 'support'));
    await bootstrap(db);
    await expect(db.select().from(pages)).resolves.toHaveLength(1);
  });
});
