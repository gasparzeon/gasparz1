import { revalidatePath } from 'next/cache';

import { consumeCommentAttempt } from '@/lib/auth/rate-limit';
import { getDb } from '@/lib/db';
import { createFakeDb, type FakeDb } from '@/test/helpers/fake-db';

import * as service from '../service';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/auth/rate-limit', () => ({ consumeCommentAttempt: jest.fn() }));

const ID = '0b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';
const POST_ID = '1b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';
const reader = { id: 'u-reader', role: 'reader' as const };
const editor = { id: 'u-editor', role: 'editor' as const };

const postRow = { id: POST_ID, slug: 'meu-post', title: 'Meu post' };
const commentRow = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  postId: POST_ID,
  authorId: reader.id,
  body: 'Ótimo post!',
  status: 'visible',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  moderatedBy: null,
  moderatedAt: null,
  ...overrides,
});
const listedRow = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  body: 'Ótimo post!',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  authorId: reader.id,
  authorName: 'Leitor',
  authorUsername: 'leitor',
  authorAvatar: '',
  ...overrides,
});

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  (getDb as jest.Mock).mockResolvedValue(fake.db);
  (consumeCommentAttempt as jest.Mock).mockResolvedValue({ allowed: true });
  jest.clearAllMocks();
});

describe('listComments', () => {
  it('lista só os visíveis, do mais antigo ao mais novo', async () => {
    fake.queue('select', [postRow]);
    fake.queue('select', [listedRow(), listedRow({ id: 'outro', body: 'Segundo' })]);

    const { post, comments } = await service.listComments('meu-post');
    expect(post).toEqual({ slug: 'meu-post', title: 'Meu post' });
    expect(comments.map((comment) => comment.body)).toEqual(['Ótimo post!', 'Segundo']);
    expect(comments[0].author).toMatchObject({ username: 'leitor' });
  });

  it('post inexistente ou rascunho dá 404', async () => {
    fake.queue('select', []);
    await expect(service.listComments('sumido')).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    });
  });

  it('autor removido aparece como "sem autor"', async () => {
    fake.queue('select', [postRow]);
    fake.queue('select', [
      listedRow({ authorId: null, authorName: null, authorUsername: null, authorAvatar: null }),
    ]);
    const { comments } = await service.listComments('meu-post');
    expect(comments[0].author).toBeNull();
  });
});

describe('createComment', () => {
  const authorRow = { id: reader.id, name: 'Leitor', username: 'leitor', avatarUrl: '' };

  it('leitor cria e o post é revalidado', async () => {
    fake.queue('select', [postRow]);
    fake.queue('insert', [
      {
        id: ID,
        createdAt: new Date('2026-10-02T00:00:00Z'),
        updatedAt: new Date('2026-10-02T00:00:00Z'),
      },
    ]);
    fake.queue('select', [authorRow]);

    const comment = await service.createComment(reader.id, 'meu-post', '  Ótimo post!  ');
    expect(comment).toMatchObject({ id: ID, body: 'Ótimo post!', author: { username: 'leitor' } });
    expect(revalidatePath).toHaveBeenCalledWith('/posts/meu-post');
    const [[values]] = fake.argsOf('insert', 'values') as { postId: string; authorId: string }[][];
    expect(values).toMatchObject({ postId: POST_ID, authorId: reader.id });
  });

  it('valida o texto e o post', async () => {
    // Texto inválido: ZodError (a rota traduz para 400 validation).
    await expect(service.createComment(reader.id, 'meu-post', '   ')).rejects.toThrow(
      'Escreva um comentário.',
    );
    await expect(service.createComment(reader.id, 'meu-post', 'x'.repeat(2001))).rejects.toThrow(
      'máximo de 2000',
    );

    fake.queue('select', []);
    await expect(service.createComment(reader.id, 'sumido', 'oi')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('flood recebe 429', async () => {
    fake.queue('select', [postRow]);
    (consumeCommentAttempt as jest.Mock).mockResolvedValue({ allowed: false, retryAfter: 60 });
    await expect(service.createComment(reader.id, 'meu-post', 'oi')).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
    });
    expect(fake.count('insert')).toBe(0);
  });
});

describe('updateComment', () => {
  it('autor edita o próprio', async () => {
    fake.queue('select', [commentRow()]);
    fake.queue('update', []);
    fake.queue('select', [{ slug: 'meu-post' }]);

    await service.updateComment(reader.id, ID, 'Ainda melhor!');
    const [[values]] = fake.argsOf('update', 'set') as { body: string }[][];
    expect(values.body).toBe('Ainda melhor!');
    expect(revalidatePath).toHaveBeenCalledWith('/posts/meu-post');
  });

  it('outra pessoa não edita (nem moderador reescreve)', async () => {
    fake.queue('select', [commentRow()]);
    await expect(service.updateComment('outra-pessoa', ID, 'hack')).rejects.toMatchObject({
      status: 403,
    });
    fake.queue('select', [commentRow()]);
    await expect(service.updateComment(editor.id, ID, 'reescrito')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('id inválido dá 404', async () => {
    await expect(service.updateComment(reader.id, 'x', 'oi')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('deleteComment', () => {
  it('autor apaga o próprio', async () => {
    fake.queue('select', [commentRow()]);
    fake.queue('delete', []);
    fake.queue('select', [{ slug: 'meu-post' }]);

    await service.deleteComment(reader, ID);
    expect(fake.count('delete')).toBe(1);
    expect(revalidatePath).toHaveBeenCalledWith('/posts/meu-post');
  });

  it('moderador apaga qualquer um; leitor não apaga o dos outros', async () => {
    fake.queue('select', [commentRow()]);
    fake.queue('delete', []);
    fake.queue('select', [{ slug: 'meu-post' }]);
    await service.deleteComment(editor, ID);
    expect(fake.count('delete')).toBe(1);

    fake.queue('select', [commentRow()]);
    await expect(service.deleteComment({ id: 'outra', role: 'reader' }, ID)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('setCommentVisibility', () => {
  it('editor oculta e mostra, registrando quem moderou', async () => {
    fake.queue('select', [commentRow()]);
    fake.queue('update', []);
    fake.queue('select', [{ slug: 'meu-post' }]);

    await service.setCommentVisibility(editor, ID, 'hidden');
    const [[values]] = fake.argsOf('update', 'set') as {
      status: string;
      moderatedBy: string;
    }[][];
    expect(values).toMatchObject({ status: 'hidden', moderatedBy: editor.id });
    expect(revalidatePath).toHaveBeenCalledWith('/posts/meu-post');
  });

  it('leitor e autor não moderam', async () => {
    await expect(service.setCommentVisibility(reader, ID, 'hidden')).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      service.setCommentVisibility({ id: 'u', role: 'author' }, ID, 'hidden'),
    ).rejects.toMatchObject({ status: 403 });
    expect(fake.count('update')).toBe(0);
  });
});

describe('listCommentsForAdmin', () => {
  it('editor vê tudo com post e status', async () => {
    fake.queue('select', [
      {
        ...listedRow(),
        status: 'hidden',
        moderatedAt: new Date('2026-10-03T00:00:00Z'),
        moderatedBy: 'ed',
        postSlug: 'meu-post',
        postTitle: 'Meu post',
      },
    ]);

    const comments = await service.listCommentsForAdmin(editor);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      status: 'hidden',
      postSlug: 'meu-post',
      moderatedBy: 'ed',
    });
  });

  it('leitor não lista', async () => {
    await expect(service.listCommentsForAdmin(reader)).rejects.toMatchObject({ status: 403 });
  });
});
