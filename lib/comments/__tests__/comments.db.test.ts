import { closeDb, createPost, createUser, resetDb } from '@/test/helpers/db';

import {
  createComment,
  deleteComment,
  listComments,
  listCommentsForAdmin,
  setCommentVisibility,
  updateComment,
} from '../service';

// Comentários contra Postgres de verdade (PGlite): SQL, FKs e status.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

let reader: Awaited<ReturnType<typeof createUser>>;
let author: Awaited<ReturnType<typeof createUser>>;
let editor: Awaited<ReturnType<typeof createUser>>;
let post: Awaited<ReturnType<typeof createPost>>;

beforeEach(async () => {
  await resetDb();
  reader = await createUser({ username: 'leitor', role: 'reader', status: 'active' });
  author = await createUser({ username: 'autor', role: 'author', status: 'active' });
  editor = await createUser({ username: 'editor', role: 'editor', status: 'active' });
  post = await createPost(author.id, { slug: 'post-comentado', publishedAt: '2026-01-01' });
});

afterAll(async () => {
  await closeDb();
});

it('leitor cria, lista mostra, autor edita o próprio', async () => {
  const created = await createComment(reader.id, 'post-comentado', 'Ótimo post!');
  expect(created).toMatchObject({ body: 'Ótimo post!', author: { username: 'leitor' } });

  const { comments } = await listComments('post-comentado');
  expect(comments).toHaveLength(1);

  await updateComment(reader.id, created.id, 'Ótimo post mesmo!');
  const { comments: after } = await listComments('post-comentado');
  expect(after[0].body).toBe('Ótimo post mesmo!');
});

it('outra pessoa não edita nem apaga', async () => {
  const created = await createComment(reader.id, 'post-comentado', 'Oi');
  await expect(updateComment(author.id, created.id, 'hack')).rejects.toMatchObject({
    status: 403,
  });
  await expect(deleteComment({ id: author.id, role: 'author' }, created.id)).rejects.toMatchObject({
    status: 403,
  });
  // Continua lá.
  await expect(listComments('post-comentado')).resolves.toMatchObject({
    comments: expect.arrayContaining([expect.objectContaining({ id: created.id })]),
  });
});

it('editor oculta (some do site) e mostra de novo; apagar remove', async () => {
  const created = await createComment(reader.id, 'post-comentado', 'Polêmico');
  await setCommentVisibility({ id: editor.id, role: 'editor' }, created.id, 'hidden');

  await expect(listComments('post-comentado')).resolves.toMatchObject({ comments: [] });
  const hidden = await listCommentsForAdmin({ id: editor.id, role: 'editor' });
  expect(hidden).toMatchObject([
    { id: created.id, status: 'hidden', moderatedBy: editor.username },
  ]);

  await setCommentVisibility({ id: editor.id, role: 'editor' }, created.id, 'visible');
  await expect(listComments('post-comentado')).resolves.toMatchObject({
    comments: [expect.objectContaining({ id: created.id })],
  });

  await deleteComment({ id: editor.id, role: 'editor' }, created.id);
  await expect(listComments('post-comentado')).resolves.toMatchObject({ comments: [] });
});

it('post rascunho ou inexistente não recebe comentário', async () => {
  const draft = await createPost(author.id, { slug: 'rascunho', status: 'draft' });
  await expect(createComment(reader.id, draft.slug, 'Oi')).rejects.toMatchObject({ status: 404 });
  await expect(createComment(reader.id, 'sumido', 'Oi')).rejects.toMatchObject({ status: 404 });
  await expect(listComments(draft.slug)).rejects.toMatchObject({ status: 404 });
});

it('apagar o post remove os comentários; apagar a conta mantém o texto sem autor', async () => {
  const { getDb } = await import('@/lib/db');
  const { users, posts } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const kept = await createComment(reader.id, 'post-comentado', 'Fica!');
  const realDb = await getDb();

  await realDb.delete(users).where(eq(users.id, reader.id));
  await expect(listComments('post-comentado')).resolves.toMatchObject({
    comments: [expect.objectContaining({ id: kept.id, author: null })],
  });

  await realDb.delete(posts).where(eq(posts.id, post.id));
  await expect(listComments('post-comentado')).rejects.toMatchObject({ status: 404 });
});
