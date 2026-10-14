import { eq } from 'drizzle-orm';

import { posts, users } from '@/lib/db/schema';
import { closeDb, createPost, createUser, getDb, resetDb } from '@/test/helpers/db';
import { fastHash } from '@/test/helpers/password';

import {
  acceptInvite,
  approveUser,
  changePassword,
  countPendingUsers,
  createPasswordReset,
  deleteUser,
  getAccessRequest,
  getProfile,
  getSessionUser,
  getSignupEnabled,
  getTokenUser,
  inviteUser,
  listActiveAuthors,
  listUsers,
  regenerateInvite,
  registerReader,
  rejectUser,
  requestAccess,
  requestAccessAgain,
  resetPassword,
  setSignupEnabled,
  updateProfile,
  updateRequestNote,
  updateUser,
  verifyLogin,
} from '../service';

// Serviço real contra Postgres (PGlite). Só o hash de senha é trocado por
// uma versão rápida (N=2^14) para o teste não gastar segundos em scrypt.
jest.mock('@/lib/auth/password', () => {
  const actual = jest.requireActual('@/lib/auth/password');
  const { fastHash: fast } = jest.requireActual('@/test/helpers/password');
  return { ...actual, hashPassword: async (password: string) => fast(password) };
});

const actorOf = (user: { id: string; role: string }) =>
  ({ id: user.id, role: user.role }) as { id: string; role: 'owner' };

let owner: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await resetDb();
  owner = await createUser({ username: 'gaspar', name: 'Gaspar', role: 'owner', email: 'g@x.com' });
});

afterAll(async () => {
  await closeDb();
});

describe('login', () => {
  it('aceita usuário ou e-mail, sem diferenciar maiúsculas', async () => {
    await expect(verifyLogin('GASPAR', 'senha-de-teste-123')).resolves.toMatchObject({ ok: true });
    await expect(verifyLogin('G@X.COM', 'senha-de-teste-123')).resolves.toMatchObject({ ok: true });
  });

  it('recusa senha errada e usuário inexistente com a mesma resposta', async () => {
    await expect(verifyLogin('gaspar', 'errada-errada')).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    });
    await expect(verifyLogin('ninguem', 'qualquer-coisa')).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('só revela pendente/recusado/suspenso depois da senha correta', async () => {
    const pending = await createUser({ username: 'pendente', status: 'pending' });
    const rejected = await createUser({ username: 'recusado', status: 'rejected' });
    await createUser({ username: 'suspenso', status: 'suspended' });

    // Conta não aprovada: devolve o id para o ticket do pedido, nunca o usuário.
    await expect(verifyLogin('pendente', 'senha-de-teste-123')).resolves.toEqual({
      ok: false,
      reason: 'pending',
      userId: pending.id,
    });
    await expect(verifyLogin('recusado', 'senha-de-teste-123')).resolves.toEqual({
      ok: false,
      reason: 'rejected',
      userId: rejected.id,
    });
    await expect(verifyLogin('recusado', 'senha-errada-123')).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    });
    await expect(verifyLogin('suspenso', 'senha-de-teste-123')).resolves.toEqual({
      ok: false,
      reason: 'suspended',
    });
    await expect(verifyLogin('pendente', 'senha-errada-123')).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('registra o último acesso', async () => {
    await verifyLogin('gaspar', 'senha-de-teste-123');
    const db = await getDb();
    const [row] = await db.select().from(users).where(eq(users.id, owner.id));
    expect(row.lastLoginAt).toBeInstanceOf(Date);
  });
});

describe('pedidos de acesso', () => {
  const request = {
    name: 'Carla',
    username: 'Carla_Dev',
    email: 'Carla@Example.com',
    password: 'frase-senha-longa',
    note: 'Escrevo sobre IA.',
  };

  it('cria conta pendente (colaborador) e normaliza usuário e e-mail', async () => {
    const created = await requestAccess(request);
    const db = await getDb();
    const [row] = await db.select().from(users).where(eq(users.username, 'carla_dev'));
    expect(created.id).toBe(row.id);

    expect(row).toMatchObject({
      email: 'carla@example.com',
      status: 'pending',
      role: 'contributor',
      requestNote: 'Escrevo sobre IA.',
    });
    await expect(countPendingUsers()).resolves.toBe(1);
  });

  it('recusa duplicados, senha fraca e pedidos com cadastro fechado', async () => {
    await requestAccess(request);
    await expect(requestAccess({ ...request, username: 'outra' })).rejects.toMatchObject({
      code: 'exists',
    });
    await expect(
      requestAccess({ ...request, username: 'nova', email: 'n@x.com', password: 'curta' }),
    ).rejects.toThrow(/12 caracteres/);

    await setSignupEnabled(actorOf(owner), false);
    await expect(getSignupEnabled()).resolves.toBe(false);
    await expect(
      requestAccess({ ...request, username: 'tarde', email: 't@x.com' }),
    ).rejects.toMatchObject({ code: 'closed' });
  });

  it('enquanto espera, a pessoa vê o pedido e ajusta a mensagem', async () => {
    const { id } = await requestAccess(request);

    await updateRequestNote(id, '  Escrevo sobre IA e Go.  ');
    await expect(getAccessRequest(id)).resolves.toMatchObject({
      username: 'carla_dev',
      status: 'pending',
      note: 'Escrevo sobre IA e Go.',
      reviewedBy: null,
    });
    await expect(updateRequestNote(id, 'x'.repeat(501))).rejects.toThrow(/longa/);
    await expect(getAccessRequest('nao-e-uuid')).resolves.toBeNull();
  });

  it('pedido recusado pode ser refeito e volta para o fim da fila', async () => {
    const { id } = await requestAccess(request);
    await rejectUser(actorOf(owner), id);

    await expect(updateRequestNote(id, 'mudei')).rejects.toMatchObject({ code: 'not_pending' });
    const before = (await getAccessRequest(id))!;
    expect(before).toMatchObject({ status: 'rejected', reviewedBy: 'gaspar' });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await requestAccessAgain(id, 'Agora com portfólio.');
    const after = (await getAccessRequest(id))!;
    expect(after).toMatchObject({ status: 'pending', note: 'Agora com portfólio.' });
    expect(after.requestedAt.getTime()).toBeGreaterThan(before.requestedAt.getTime());
    // A recusa anterior continua registrada para quem for revisar.
    expect(after.reviewedBy).toBe('gaspar');

    await expect(requestAccessAgain(id, '')).rejects.toMatchObject({ code: 'not_rejected' });
  });

  it('não deixa refazer o pedido com o cadastro fechado', async () => {
    const { id } = await requestAccess(request);
    await rejectUser(actorOf(owner), id);
    await setSignupEnabled(actorOf(owner), false);
    await expect(requestAccessAgain(id, '')).rejects.toMatchObject({ code: 'closed' });
  });

  it('só administradores mudam a configuração de cadastro', async () => {
    const editor = await createUser({ role: 'editor' });
    await expect(setSignupEnabled(actorOf(editor), false)).rejects.toMatchObject({ status: 403 });
  });
});

describe('conta de leitor', () => {
  const signup = {
    name: 'Léo',
    username: 'Leo_Reader',
    email: 'Leo@Example.com',
    password: 'frase-senha-longa',
  };

  it('cria ativa como leitor e entra na hora (sem pedido)', async () => {
    const created = await registerReader(signup);
    const db = await getDb();
    const [row] = await db.select().from(users).where(eq(users.id, created.id));
    expect(row).toMatchObject({
      username: 'leo_reader',
      email: 'leo@example.com',
      role: 'reader',
      status: 'active',
    });
    await expect(countPendingUsers()).resolves.toBe(0);
    await expect(verifyLogin('leo_reader', 'frase-senha-longa')).resolves.toMatchObject({
      ok: true,
    });
  });

  it('recusa duplicados e cadastro fechado', async () => {
    await registerReader(signup);
    await expect(registerReader({ ...signup, username: 'outro' })).rejects.toMatchObject({
      code: 'exists',
    });
    await setSignupEnabled(actorOf(owner), false);
    await expect(
      registerReader({ ...signup, username: 'tarde', email: 't@x.com' }),
    ).rejects.toMatchObject({ code: 'closed' });
  });

  it('leitor não aparece como autor nem recebe posts', async () => {
    const leitor = await createUser({ username: 'leitor', role: 'reader', status: 'active' });
    const autor = await createUser({ username: 'autor', role: 'author', status: 'active' });
    const authors = await listActiveAuthors();
    expect(authors).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: 'autor' })]),
    );
    expect(authors).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ username: 'leitor' })]),
    );

    await createPost(autor.id, { slug: 'do-autor' });
    await expect(deleteUser(actorOf(owner), autor.id, leitor.id)).rejects.toMatchObject({
      code: 'invalid_heir',
    });
  });
});

describe('aprovação e gestão', () => {
  it('administrador aprova pedidos com um papel abaixo do dele', async () => {
    const admin = await createUser({ role: 'admin' });
    const pending = await createUser({ status: 'pending', role: 'contributor' });

    await expect(approveUser(actorOf(admin), pending.id, 'admin')).rejects.toMatchObject({
      status: 403,
    });
    await approveUser(actorOf(admin), pending.id, 'author');

    const user = await getSessionUser(pending.id);
    expect(user).toMatchObject({ status: 'active', role: 'author' });
    await expect(approveUser(actorOf(admin), pending.id, 'author')).rejects.toMatchObject({
      code: 'not_pending',
    });
  });

  it('recusar registra quem decidiu, não apaga a conta e não deixa entrar', async () => {
    const admin = await createUser({ role: 'admin', username: 'admin1' });
    const pending = await createUser({ status: 'pending', role: 'contributor' });

    await rejectUser(actorOf(admin), pending.id);
    await expect(rejectUser(actorOf(admin), pending.id)).rejects.toMatchObject({
      code: 'not_pending',
    });

    const list = await listUsers(actorOf(owner));
    expect(list.find((user) => user.id === pending.id)).toMatchObject({
      status: 'rejected',
      reviewedBy: 'admin1',
    });
    await expect(getSessionUser(pending.id)).resolves.toMatchObject({ status: 'rejected' });
    // Recusados não podem ser suspensos/reativados: só aprovados ou apagados.
    await expect(
      updateUser(actorOf(owner), pending.id, { status: 'active' }),
    ).rejects.toMatchObject({ code: 'not_approved' });
  });

  it('administrador pode aprovar quem tinha recusado, e a decisão fica registrada', async () => {
    const rejected = await createUser({ status: 'rejected', role: 'contributor' });
    await approveUser(actorOf(owner), rejected.id, 'contributor');

    const list = await listUsers(actorOf(owner));
    expect(list.find((user) => user.id === rejected.id)).toMatchObject({
      status: 'active',
      role: 'contributor',
      reviewedBy: 'gaspar',
    });
  });

  it('só gerencia pedidos quem pode gerenciar a pessoa', async () => {
    const editor = await createUser({ role: 'editor' });
    const pending = await createUser({ status: 'pending' });
    await expect(rejectUser(actorOf(editor), pending.id)).rejects.toMatchObject({ status: 403 });
    await expect(approveUser(actorOf(editor), pending.id, 'author')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('editores e autores não gerenciam usuários', async () => {
    const editor = await createUser({ role: 'editor' });
    const target = await createUser({ role: 'author' });
    await expect(listUsers(actorOf(editor))).rejects.toMatchObject({ status: 403 });
    await expect(updateUser(actorOf(editor), target.id, { role: 'editor' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('ninguém altera o dono, nem um administrador altera outro', async () => {
    const admin = await createUser({ role: 'admin' });
    const otherAdmin = await createUser({ role: 'admin' });

    await expect(
      updateUser(actorOf(admin), owner.id, { status: 'suspended' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateUser(actorOf(admin), otherAdmin.id, { role: 'author' }),
    ).rejects.toMatchObject({ status: 403 });
    await updateUser(actorOf(owner), otherAdmin.id, { role: 'editor' });
    await expect(getSessionUser(otherAdmin.id)).resolves.toMatchObject({ role: 'editor' });
  });

  it('suspender derruba as sessões existentes (sessionsValidAfter)', async () => {
    const author = await createUser();
    const before = (await getSessionUser(author.id))!.sessionsValidAfter;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await updateUser(actorOf(owner), author.id, { status: 'suspended' });

    const after = (await getSessionUser(author.id))!;
    expect(after.status).toBe('suspended');
    expect(after.sessionsValidAfter.getTime()).toBeGreaterThan(before.getTime());
  });

  it('lista usuários com contagem de posts, pendentes primeiro e recusados por último', async () => {
    const author = await createUser({ username: 'autora' });
    await createPost(author.id);
    await createPost(author.id);
    await createUser({ username: 'recusada', status: 'rejected' });
    await createUser({ username: 'pendente', status: 'pending' });

    const list = await listUsers(actorOf(owner));
    expect(list[0]).toMatchObject({ username: 'pendente', status: 'pending' });
    expect(list.at(-1)).toMatchObject({ username: 'recusada', status: 'rejected' });
    expect(list.find((user) => user.username === 'autora')?.postCount).toBe(2);
  });
});

describe('remoção', () => {
  it('exige transferir os posts e transfere atomicamente', async () => {
    const author = await createUser();
    const heir = await createUser({ username: 'herdeira' });
    await createPost(author.id, { slug: 'post-a' });

    await expect(deleteUser(actorOf(owner), author.id)).rejects.toMatchObject({
      code: 'has_posts',
    });
    await expect(deleteUser(actorOf(owner), author.id, author.id)).rejects.toMatchObject({
      code: 'invalid_heir',
    });

    await deleteUser(actorOf(owner), author.id, heir.id);
    const db = await getDb();
    const [post] = await db.select().from(posts).where(eq(posts.slug, 'post-a'));
    expect(post.authorId).toBe(heir.id);
    await expect(getSessionUser(author.id)).resolves.toBeNull();
  });

  it('recusar um pedido apaga a conta pendente', async () => {
    const pending = await createUser({ status: 'pending' });
    await deleteUser(actorOf(owner), pending.id);
    await expect(getSessionUser(pending.id)).resolves.toBeNull();
  });
});

describe('convites', () => {
  it('cria conta convidada e o link de uso único ativa a conta', async () => {
    const { userId, token } = await inviteUser(actorOf(owner), {
      name: 'Ana Autora',
      email: 'ana@x.com',
      role: 'author',
    });

    await expect(getTokenUser('invite', token)).resolves.toMatchObject({ name: 'Ana Autora' });
    await expect(verifyLogin('ana@x.com', 'qualquer-senha-1')).resolves.toMatchObject({
      ok: false,
    });

    await acceptInvite(token, { name: 'Ana', username: 'ana', password: 'senha-da-ana-123' });

    await expect(getSessionUser(userId)).resolves.toMatchObject({
      status: 'active',
      username: 'ana',
    });
    await expect(verifyLogin('ana', 'senha-da-ana-123')).resolves.toMatchObject({ ok: true });
    await expect(getTokenUser('invite', token)).resolves.toBeNull();
    await expect(
      acceptInvite(token, { name: 'Ana', username: 'ana2', password: 'outra-senha-123' }),
    ).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('se o usuário escolhido já existir, o link continua válido', async () => {
    const { token } = await inviteUser(actorOf(owner), { name: 'Bia', role: 'contributor' });

    await expect(
      acceptInvite(token, { name: 'Bia', username: 'gaspar', password: 'senha-da-bia-123' }),
    ).rejects.toMatchObject({ code: 'exists' });
    await expect(getTokenUser('invite', token)).resolves.not.toBeNull();
  });

  it('gerar um novo link invalida o anterior', async () => {
    const { userId, token } = await inviteUser(actorOf(owner), { name: 'Caio', role: 'author' });
    const fresh = await regenerateInvite(actorOf(owner), userId);

    await expect(getTokenUser('invite', token)).resolves.toBeNull();
    await expect(getTokenUser('invite', fresh)).resolves.not.toBeNull();
  });

  it('administrador não convida com papel de administrador', async () => {
    const admin = await createUser({ role: 'admin' });
    await expect(inviteUser(actorOf(admin), { name: 'X', role: 'admin' })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('senha', () => {
  it('link de redefinição troca a senha e encerra as sessões', async () => {
    const author = await createUser({ username: 'autor' });
    const token = await createPasswordReset(actorOf(owner), author.id);
    const before = (await getSessionUser(author.id))!.sessionsValidAfter;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await resetPassword(token, 'nova-senha-forte-1');

    await expect(verifyLogin('autor', 'nova-senha-forte-1')).resolves.toMatchObject({ ok: true });
    await expect(verifyLogin('autor', 'senha-de-teste-123')).resolves.toMatchObject({ ok: false });
    const after = (await getSessionUser(author.id))!.sessionsValidAfter;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
    await expect(resetPassword(token, 'mais-uma-senha-1')).rejects.toMatchObject({
      code: 'invalid_token',
    });
  });

  it('trocar a senha exige a senha atual', async () => {
    await expect(changePassword(owner.id, 'errada-errada', 'nova-senha-123')).rejects.toMatchObject(
      {
        code: 'wrong_password',
      },
    );
    await changePassword(owner.id, 'senha-de-teste-123', 'nova-senha-123');
    await expect(verifyLogin('gaspar', 'nova-senha-123')).resolves.toMatchObject({ ok: true });
  });

  it('o hash gravado nunca é a senha em texto', async () => {
    const db = await getDb();
    const [row] = await db.select().from(users).where(eq(users.id, owner.id));
    expect(row.passwordHash).toMatch(/^scrypt:/);
    expect(row.passwordHash).not.toContain('senha');
    expect(fastHash('x')).not.toBe(fastHash('x'));
  });
});

describe('perfil', () => {
  it('atualiza dados e recusa usuário ou e-mail de outra conta', async () => {
    await createUser({ username: 'ocupado', email: 'ocupado@x.com' });

    await updateProfile(owner.id, {
      name: 'Gaspar Labs',
      username: 'gaspar',
      email: '',
      bio: 'Pesquisa.',
      avatarUrl: '/uploads/eu.png',
    });
    await expect(getSessionUser(owner.id)).resolves.toMatchObject({ name: 'Gaspar Labs' });

    await expect(
      updateProfile(owner.id, {
        name: 'X',
        username: 'ocupado',
        email: '',
        bio: '',
        avatarUrl: '',
      }),
    ).rejects.toMatchObject({ code: 'exists' });
    await expect(
      updateProfile(owner.id, {
        name: 'X',
        username: 'gaspar',
        email: '',
        bio: '',
        avatarUrl: 'javascript:alert(1)',
      }),
    ).rejects.toThrow();
  });

  it('redes: salva o link oficial no banco (jsonb), lê de volta e mantém sem a lista', async () => {
    const profile = {
      name: 'Gaspar',
      username: 'gaspar',
      email: '',
      bio: '',
      avatarUrl: '',
    };
    await updateProfile(owner.id, {
      ...profile,
      socials: [
        { network: 'instagram', value: 'instagram.com/gaspar.labs?igsh=1', label: 'Gaspar Labs' },
        { network: 'spotify', value: '@gasparzeon', label: '' },
      ],
    });
    const expected = [
      {
        network: 'spotify',
        handle: 'gasparzeon',
        url: 'https://open.spotify.com/user/gasparzeon',
        label: '',
      },
      {
        network: 'instagram',
        handle: 'gaspar.labs',
        url: 'https://www.instagram.com/gaspar.labs/',
        label: 'Gaspar Labs',
      },
    ];
    expect((await getProfile(owner.id))?.socials).toEqual(expected);

    // Sem a lista: as redes ficam como estavam.
    await updateProfile(owner.id, { ...profile, bio: 'Nova bio.' });
    expect((await getProfile(owner.id))?.socials).toEqual(expected);

    await updateProfile(owner.id, { ...profile, socials: [] });
    expect((await getProfile(owner.id))?.socials).toEqual([]);
  });

  it('README: grava limpo, mantém sem o campo e apaga com texto vazio', async () => {
    const profile = { name: 'Gaspar', username: 'gaspar', email: '', bio: '', avatarUrl: '' };
    expect((await getProfile(owner.id))?.readme).toBe('');

    await updateProfile(owner.id, { ...profile, readme: '### Sobre mim\r\nPesquiso urnas.  ' });
    expect((await getProfile(owner.id))?.readme).toBe('### Sobre mim\nPesquiso urnas.');

    await updateProfile(owner.id, { ...profile, bio: 'Outra bio.' });
    expect((await getProfile(owner.id))?.readme).toBe('### Sobre mim\nPesquiso urnas.');

    await updateProfile(owner.id, { ...profile, readme: '' });
    expect((await getProfile(owner.id))?.readme).toBe('');
  });
});
