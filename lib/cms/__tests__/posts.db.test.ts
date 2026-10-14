import { revalidatePath } from 'next/cache';

import type { Actor } from '@/lib/auth/permissions';
import { closeDb, createPost, createUser, resetDb } from '@/test/helpers/db';

import {
  createPost as create,
  deletePost,
  getPostForEditor,
  listPostsForAdmin,
  listTags,
  updatePost,
} from '../posts';
import type { PostInput } from '../schema';

// Serviço real contra Postgres (PGlite); só o revalidatePath do Next é mock.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
const mockRevalidate = revalidatePath as jest.Mock;

const input = (overrides: Partial<PostInput> = {}): PostInput => ({
  slug: 'meu-post',
  title: 'Meu post',
  excerpt: 'Resumo',
  publishedAt: '2026-10-12',
  updatedAt: '',
  tags: ['ia', 'web'],
  section: '',
  coverImage: '',
  content: 'Linha\r\nOutra',
  ...overrides,
});

const actor = (user: { id: string; role: string }) => ({ id: user.id, role: user.role }) as Actor;

let editor: Awaited<ReturnType<typeof createUser>>;
let author: Awaited<ReturnType<typeof createUser>>;
let contributor: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await resetDb();
  editor = await createUser({ username: 'editora', role: 'editor' });
  author = await createUser({ username: 'autor', role: 'author' });
  contributor = await createUser({ username: 'colab', role: 'contributor' });
});

afterAll(async () => {
  await closeDb();
});

describe('criação', () => {
  it('autor publica; o post volta com autor, versão 1 e quebras normalizadas', async () => {
    const post = await create(actor(author), input(), 'published');

    expect(post).toMatchObject({
      slug: 'meu-post',
      status: 'published',
      version: 1,
      content: 'Linha\nOutra',
      author: { id: author.id, username: 'autor' },
    });
    expect(mockRevalidate).toHaveBeenCalledWith('/', 'layout');
  });

  it('guarda a seção do arquivo; vazio vira "sem seção"', async () => {
    const post = await create(actor(author), input({ section: 'pesquisas' }), 'draft');
    expect(post.section).toBe('pesquisas');

    const edited = await updatePost(actor(author), post.id, input({ section: '' }), 'draft', 1);
    expect(edited.section).toBe('');
  });

  it('colaborador só cria rascunho ou envia para revisão', async () => {
    await expect(create(actor(contributor), input(), 'published')).rejects.toMatchObject({
      status: 403,
    });
    const post = await create(actor(contributor), input(), 'review');
    expect(post.status).toBe('review');
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('slug duplicado vira 409', async () => {
    await create(actor(author), input(), 'draft');
    await expect(create(actor(editor), input(), 'draft')).rejects.toMatchObject({
      status: 409,
      code: 'exists',
    });
  });

  it('só editores escolhem outro autor', async () => {
    await expect(
      create(actor(author), input({ authorId: editor.id }), 'draft'),
    ).rejects.toMatchObject({ status: 403 });

    const post = await create(actor(editor), input({ authorId: author.id }), 'draft');
    expect(post.author.id).toBe(author.id);
  });

  it('leitor não serve como autor', async () => {
    const leitor = await createUser({ username: 'leitor', role: 'reader', status: 'active' });
    await expect(
      create(actor(editor), input({ authorId: leitor.id }), 'draft'),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_author' });
  });
});

describe('edição e permissões', () => {
  it('autor não edita post de outro autor; editor edita qualquer um', async () => {
    const theirs = await createPost(editor.id, { status: 'draft' });

    await expect(getPostForEditor(actor(author), theirs.id)).rejects.toMatchObject({ status: 403 });
    await expect(getPostForEditor(actor(editor), theirs.id)).resolves.toMatchObject({
      id: theirs.id,
    });
  });

  it('colaborador edita o próprio post em revisão, mas não depois de publicado', async () => {
    const post = await create(actor(contributor), input(), 'review');
    const edited = await updatePost(
      actor(contributor),
      post.id,
      input({ title: 'Revisado' }),
      'review',
      1,
    );
    expect(edited).toMatchObject({ title: 'Revisado', version: 2 });

    await expect(
      updatePost(actor(contributor), post.id, input(), 'published', 2),
    ).rejects.toMatchObject({ status: 403 });

    // Editor aprova e publica.
    await updatePost(actor(editor), post.id, input({ title: 'Revisado' }), 'published', 2);
    await expect(getPostForEditor(actor(contributor), post.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('concorrência otimista: versão antiga é recusada', async () => {
    const post = await create(actor(author), input(), 'draft');
    await updatePost(actor(author), post.id, input({ title: 'v2' }), 'draft', 1);

    await expect(
      updatePost(actor(author), post.id, input({ title: 'v2 de outra aba' }), 'draft', 1),
    ).rejects.toMatchObject({ status: 409, code: 'conflict' });
  });

  it('renomear o slug mantém o id do post', async () => {
    const post = await create(actor(author), input(), 'published');
    const renamed = await updatePost(
      actor(author),
      post.id,
      input({ slug: 'novo' }),
      'published',
      1,
    );
    expect(renamed).toMatchObject({ id: post.id, slug: 'novo' });
  });

  it('id inválido vira 404 sem erro de banco', async () => {
    await expect(getPostForEditor(actor(editor), 'nao-e-uuid')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('remoção', () => {
  it('confere a versão e respeita permissões', async () => {
    const post = await create(actor(author), input(), 'published');

    await expect(deletePost(actor(contributor), post.id, 1)).rejects.toMatchObject({ status: 403 });
    await expect(deletePost(actor(author), post.id, 7)).rejects.toMatchObject({ status: 409 });
    await deletePost(actor(author), post.id, 1);
    await expect(getPostForEditor(actor(editor), post.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('listagem do painel', () => {
  it('editor vê todos (revisões primeiro); autor e colaborador só os próprios', async () => {
    await createPost(author.id, { slug: 'do-autor', status: 'published' });
    await createPost(contributor.id, { slug: 'do-colab', status: 'review' });
    await createPost(editor.id, { slug: 'da-editora', status: 'draft' });

    const all = await listPostsForAdmin(actor(editor));
    expect(all.map((post) => post.slug)[0]).toBe('do-colab');
    expect(all).toHaveLength(3);

    const mineOnly = await listPostsForAdmin(actor(editor), { onlyMine: true });
    expect(mineOnly.map((post) => post.slug)).toEqual(['da-editora']);

    const authorView = await listPostsForAdmin(actor(author));
    expect(authorView.map((post) => post.slug)).toEqual(['do-autor']);
    expect(authorView[0].wordCount).toBe(3);
  });

  it('lista tags únicas em ordem', async () => {
    await createPost(author.id, { tags: ['web', 'ia'] });
    await createPost(author.id, { tags: ['ia', 'rust'] });
    await expect(listTags()).resolves.toEqual(['ia', 'rust', 'web']);
  });
});
