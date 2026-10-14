import { closeDb, createPost, createUser, resetDb } from '@/test/helpers/db';

import {
  BLOG_TIMEZONE,
  getAllPosts,
  getAllTags,
  getAuthor,
  getPostBySlug,
  getPostsByAuthor,
} from '../content';

// Leitura pública contra Postgres (PGlite). "Hoje" é contado no fuso do blog,
// como o site faz: assim o teste não depende da hora nem do fuso da máquina.
const inBlogTimezone = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BLOG_TIMEZONE }).format(date);
const today = inBlogTimezone(new Date());
const tomorrow = inBlogTimezone(new Date(Date.now() + 86_400_000));

let author: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await resetDb();
  author = await createUser({ username: 'ana', name: 'Ana Autora', bio: 'Escreve sobre IA.' });
});

afterAll(async () => {
  await closeDb();
});

describe('site público', () => {
  it('mostra só publicados com data de hoje ou anterior, do mais novo ao mais antigo', async () => {
    await createPost(author.id, { slug: 'antigo', publishedAt: '2025-01-01' });
    await createPost(author.id, { slug: 'hoje', publishedAt: today });
    await createPost(author.id, { slug: 'agendado', publishedAt: tomorrow });
    await createPost(author.id, { slug: 'rascunho', status: 'draft' });
    await createPost(author.id, { slug: 'em-revisao', status: 'review' });

    const posts = await getAllPosts();
    expect(posts.map((post) => post.slug)).toEqual(['hoje', 'antigo']);
    expect(posts[0]).toMatchObject({
      draft: false,
      readingTime: '1 min',
      author: { name: 'Ana Autora', username: 'ana' },
    });
  });

  it('getPostBySlug não expõe rascunhos, agendados nem slugs maliciosos', async () => {
    await createPost(author.id, { slug: 'publicado', content: 'Olá **mundo**' });
    await createPost(author.id, { slug: 'secreto', status: 'draft' });
    await createPost(author.id, { slug: 'futuro', publishedAt: tomorrow });

    await expect(getPostBySlug('publicado')).resolves.toMatchObject({ content: 'Olá **mundo**' });
    await expect(getPostBySlug('secreto')).resolves.toBeNull();
    await expect(getPostBySlug('futuro')).resolves.toBeNull();
    await expect(getPostBySlug("x' or '1'='1")).resolves.toBeNull();
  });

  it('calcula o tempo de leitura (200 palavras por minuto)', async () => {
    await createPost(author.id, { slug: 'longo', content: 'palavra '.repeat(1000) });
    const [post] = await getAllPosts();
    expect(post.readingTime).toBe('5 min');
  });

  it('agrega tags e posts por autor; autor suspenso não tem página', async () => {
    await createPost(author.id, { slug: 'a', tags: ['ia', 'web'] });
    const other = await createUser({ username: 'bob', status: 'suspended' });
    await createPost(other.id, { slug: 'b', tags: ['rust'] });

    await expect(getAllTags()).resolves.toEqual(['ia', 'rust', 'web']);
    await expect(getPostsByAuthor('ana')).resolves.toHaveLength(1);
    await expect(getAuthor('ANA')).resolves.toMatchObject({ bio: 'Escreve sobre IA.' });
    await expect(getAuthor('bob')).resolves.toBeNull();
  });

  it('leitor não tem página de autor', async () => {
    await createUser({ username: 'leitor', role: 'reader', status: 'active' });
    await expect(getAuthor('leitor')).resolves.toBeNull();
    await expect(getAuthor('ana')).resolves.toMatchObject({ username: 'ana' });
  });
});
