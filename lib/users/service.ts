import 'server-only';

import { revalidatePath } from 'next/cache';
import { and, asc, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { randomToken, sha256 } from '@/lib/auth/crypto';
import {
  burnPasswordCheck,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from '@/lib/auth/password';
import {
  assignableRoles,
  canManageUser,
  canManageUsers,
  type Actor,
  type Role,
} from '@/lib/auth/permissions';
import { isSafeMediaUrl } from '@/lib/cms/schema';
import { getDb, type Database } from '@/lib/db';
import { posts, settings, users, userTokens, type User } from '@/lib/db/schema';

import { readmeSchema } from './readme';
import { profileSocialsSchema, readSocials } from './socials';

export class UserError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'UserError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, 'Use de 3 a 30 letras minúsculas, números, "-" ou "_".');
export const nameSchema = z.string().trim().min(1, 'Informe o nome.').max(80, 'Nome muito longo.');
export const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido.').max(254);
const passwordSchema = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

export type SessionUser = Pick<
  User,
  'id' | 'username' | 'name' | 'role' | 'status' | 'avatarUrl' | 'sessionsValidAfter'
>;

export type ManagedUser = Pick<
  User,
  | 'id'
  | 'username'
  | 'name'
  | 'email'
  | 'bio'
  | 'avatarUrl'
  | 'role'
  | 'status'
  | 'requestNote'
  | 'createdAt'
  | 'requestedAt'
  | 'approvedAt'
  | 'reviewedAt'
  | 'lastLoginAt'
> & { postCount: number; reviewedBy: string | null };

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code === '23505' || err?.cause?.code === '23505';
}

async function findUser(db: Database, id: string) {
  if (!UUID_RE.test(id)) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

async function requireManageable(db: Database, actor: Actor, id: string) {
  const target = await findUser(db, id);
  if (!target) throw new UserError('Usuário não encontrado.', 404, 'not_found');
  if (!canManageUser(actor, target)) {
    throw new UserError('Você não pode alterar este usuário.', 403, 'forbidden');
  }
  return target;
}

function requireAssignable(actor: Actor, role: Role) {
  if (!(assignableRoles(actor.role) as Role[]).includes(role)) {
    throw new UserError('Você não pode atribuir este papel.', 403, 'forbidden');
  }
}

// ——— Sessão e login ———

export async function getSessionUser(id: string): Promise<SessionUser | null> {
  if (!UUID_RE.test(id)) return null;
  const db = await getDb();
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      status: users.status,
      avatarUrl: users.avatarUrl,
      sessionsValidAfter: users.sessionsValidAfter,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

export type LoginResult =
  | { ok: true; user: User }
  // Conta criada mas ainda não aprovada (ou recusada): não recebe sessão,
  // só pode acompanhar o próprio pedido.
  | { ok: false; reason: 'pending' | 'rejected'; userId: string }
  | { ok: false; reason: 'invalid' | 'suspended' };

// Aceita usuário ou e-mail. O status só é revelado depois da senha certa.
export async function verifyLogin(login: string, password: string): Promise<LoginResult> {
  const db = await getDb();
  const normalized = login.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(
      or(eq(sql`lower(${users.username})`, normalized), eq(sql`lower(${users.email})`, normalized)),
    )
    .limit(1);

  if (!user?.passwordHash) {
    await burnPasswordCheck(password);
    return { ok: false, reason: 'invalid' };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, reason: 'invalid' };
  }

  if (user.status === 'pending' || user.status === 'rejected') {
    return { ok: false, reason: user.status, userId: user.id };
  }
  if (user.status === 'suspended') return { ok: false, reason: 'suspended' };
  if (user.status !== 'active') return { ok: false, reason: 'invalid' };

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, user };
}

// ——— Pedidos de acesso ———

const SIGNUP_KEY = 'signup_enabled';

export async function getSignupEnabled() {
  const db = await getDb();
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SIGNUP_KEY))
    .limit(1);
  return row ? row.value === true : true;
}

export async function setSignupEnabled(actor: Actor, enabled: boolean) {
  if (!canManageUsers(actor.role)) throw new UserError('Sem permissão.', 403, 'forbidden');
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: SIGNUP_KEY, value: enabled })
    .onConflictDoUpdate({ target: settings.key, set: { value: enabled, updatedAt: new Date() } });
}

export const signupSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  note: z.string().trim().max(500, 'Mensagem muito longa.').default(''),
});

// Cadastro aberto do site: cria conta de leitor, ativa na hora. Quem escreve
// (colaborador em diante) entra por convite ou promoção de um administrador.
export const readerSignupSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export async function registerReader(input: z.input<typeof readerSignupSchema>) {
  if (!(await getSignupEnabled())) {
    throw new UserError('A criação de contas está fechada no momento.', 403, 'closed');
  }

  const data = readerSignupSchema.parse(input);
  const db = await getDb();
  const passwordHash = await hashPassword(data.password);

  try {
    const [created] = await db
      .insert(users)
      .values({
        username: data.username,
        email: data.email,
        name: data.name,
        passwordHash,
        role: 'reader',
        status: 'active',
        approvedAt: new Date(),
      })
      .returning({ id: users.id });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UserError('Usuário ou e-mail já cadastrado.', 409, 'exists');
    }
    throw error;
  }
}

export async function requestAccess(input: z.input<typeof signupSchema>) {
  // Fluxo antigo de pedido para escrever (mantido para os pedidos já abertos
  // e para a página /admin/pedido). Conta nova do site usa registerReader.
  if (!(await getSignupEnabled())) {
    throw new UserError('Os pedidos de acesso estão fechados no momento.', 403, 'closed');
  }

  const data = signupSchema.parse(input);
  const db = await getDb();
  const passwordHash = await hashPassword(data.password);

  try {
    const [created] = await db
      .insert(users)
      .values({
        username: data.username,
        email: data.email,
        name: data.name,
        passwordHash,
        requestNote: data.note,
        role: 'contributor',
        status: 'pending',
      })
      .returning({ id: users.id });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UserError('Usuário ou e-mail já cadastrado.', 409, 'exists');
    }
    throw error;
  }
}

// ——— O próprio pedido (quem ainda não foi aprovado) ———

const reviewers = alias(users, 'reviewers');

export type AccessRequest = {
  username: string;
  name: string;
  role: Role;
  status: User['status'];
  note: string;
  requestedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
};

export async function getAccessRequest(userId: string): Promise<AccessRequest | null> {
  if (!UUID_RE.test(userId)) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      username: users.username,
      name: users.name,
      role: users.role,
      status: users.status,
      note: users.requestNote,
      requestedAt: users.requestedAt,
      reviewedAt: users.reviewedAt,
      reviewedBy: reviewers.username,
    })
    .from(users)
    .leftJoin(reviewers, eq(reviewers.id, users.reviewedBy))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

const noteSchema = signupSchema.shape.note;

// Enquanto espera, a pessoa pode ajustar a mensagem para quem vai revisar.
export async function updateRequestNote(userId: string, note: string) {
  const db = await getDb();
  const updated = await db
    .update(users)
    .set({ requestNote: noteSchema.parse(note), updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.status, 'pending')))
    .returning({ id: users.id });
  if (updated.length === 0) {
    throw new UserError('Este pedido não está mais em análise.', 409, 'not_pending');
  }
}

// Pedido recusado pode ser refeito: volta para o fim da fila.
export async function requestAccessAgain(userId: string, note: string) {
  if (!(await getSignupEnabled())) {
    throw new UserError('Os pedidos de acesso estão fechados no momento.', 403, 'closed');
  }
  const db = await getDb();
  const updated = await db
    .update(users)
    .set({
      status: 'pending',
      requestNote: noteSchema.parse(note),
      requestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.status, 'rejected')))
    .returning({ id: users.id });
  if (updated.length === 0) {
    throw new UserError('Só um pedido recusado pode ser refeito.', 409, 'not_rejected');
  }
}

// ——— Gestão (administradores) ———

export async function listUsers(actor: Actor): Promise<ManagedUser[]> {
  if (!canManageUsers(actor.role)) throw new UserError('Sem permissão.', 403, 'forbidden');
  const db = await getDb();

  return db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      role: users.role,
      status: users.status,
      requestNote: users.requestNote,
      createdAt: users.createdAt,
      requestedAt: users.requestedAt,
      approvedAt: users.approvedAt,
      reviewedAt: users.reviewedAt,
      reviewedBy: reviewers.username,
      lastLoginAt: users.lastLoginAt,
      postCount: sql<number>`count(${posts.id})::int`,
    })
    .from(users)
    .leftJoin(posts, eq(posts.authorId, users.id))
    .leftJoin(reviewers, eq(reviewers.id, users.reviewedBy))
    .groupBy(users.id, reviewers.username)
    .orderBy(
      sql`case ${users.status} when 'pending' then 0 when 'invited' then 1 when 'rejected' then 3 else 2 end`,
      asc(users.requestedAt),
    );
}

export async function hasOwner() {
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'owner'))
    .limit(1);
  return Boolean(row);
}

export async function countPendingUsers() {
  const db = await getDb();
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.status, 'pending'));
  return row?.total ?? 0;
}

// Aprovar também vale para quem foi recusado (o administrador mudou de ideia).
// O filtro por status no UPDATE evita decidir duas vezes o mesmo pedido.
export async function approveUser(actor: Actor, id: string, role: Role) {
  const db = await getDb();
  const target = await requireManageable(db, actor, id);
  requireAssignable(actor, role);

  const now = new Date();
  const updated = await db
    .update(users)
    .set({
      role,
      status: 'active',
      approvedAt: now,
      approvedBy: actor.id,
      reviewedAt: now,
      reviewedBy: actor.id,
      updatedAt: now,
    })
    .where(and(eq(users.id, target.id), inArray(users.status, ['pending', 'rejected'])))
    .returning({ id: users.id });

  if (updated.length === 0) {
    throw new UserError('Este usuário não está aguardando aprovação.', 409, 'not_pending');
  }
}

// Recusar não apaga a conta: fica registrado quem decidiu, e a pessoa pode
// pedir de novo. Para spam, use a remoção.
export async function rejectUser(actor: Actor, id: string) {
  const db = await getDb();
  const target = await requireManageable(db, actor, id);

  const now = new Date();
  const updated = await db
    .update(users)
    .set({ status: 'rejected', reviewedAt: now, reviewedBy: actor.id, updatedAt: now })
    .where(and(eq(users.id, target.id), eq(users.status, 'pending')))
    .returning({ id: users.id });

  if (updated.length === 0) {
    throw new UserError('Este usuário não está aguardando aprovação.', 409, 'not_pending');
  }
}

export async function updateUser(
  actor: Actor,
  id: string,
  patch: { role?: Role; status?: 'active' | 'suspended' },
) {
  const db = await getDb();
  const target = await requireManageable(db, actor, id);
  const changes: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

  if (patch.role && patch.role !== target.role) {
    requireAssignable(actor, patch.role);
    changes.role = patch.role;
  }

  if (patch.status && patch.status !== target.status) {
    if (target.status !== 'active' && target.status !== 'suspended') {
      throw new UserError('Aprove o usuário antes de alterar o status.', 409, 'not_approved');
    }
    changes.status = patch.status;
    // Suspender derruba as sessões abertas na hora.
    if (patch.status === 'suspended') changes.sessionsValidAfter = new Date();
  }

  await db.update(users).set(changes).where(eq(users.id, id));
}

export async function deleteUser(actor: Actor, id: string, transferTo?: string | null) {
  const db = await getDb();
  await requireManageable(db, actor, id);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.authorId, id));

  if (total > 0 && !transferTo) {
    throw new UserError(
      `Este usuário tem ${total} post(s). Escolha para quem transferi-los.`,
      409,
      'has_posts',
    );
  }

  await db.transaction(async (tx) => {
    if (total > 0 && transferTo) {
      const heir = transferTo === id ? null : await findUser(tx as unknown as Database, transferTo);
      // Herdeiro precisa escrever no painel: leitor não serve.
      if (!heir || heir.status !== 'active' || heir.role === 'reader') {
        throw new UserError('Escolha um usuário ativo para receber os posts.', 400, 'invalid_heir');
      }
      await tx.update(posts).set({ authorId: heir.id }).where(eq(posts.authorId, id));
    }
    await tx.delete(users).where(eq(users.id, id));
  });
}

// ——— Convites e redefinição de senha ———

const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => sha256(token).toString('hex');

async function issueToken(
  db: Database,
  userId: string,
  purpose: 'invite' | 'reset',
  createdBy: string,
) {
  const token = randomToken(32);
  // Um link válido por vez: gerar outro invalida o anterior.
  await db
    .delete(userTokens)
    .where(
      and(
        eq(userTokens.userId, userId),
        eq(userTokens.purpose, purpose),
        isNull(userTokens.usedAt),
      ),
    );
  await db.insert(userTokens).values({
    userId,
    purpose,
    createdBy,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + (purpose === 'invite' ? INVITE_TTL : RESET_TTL)),
  });
  return token;
}

export const inviteSchema = z.object({
  name: nameSchema,
  email: z.union([emailSchema, z.literal('')]).default(''),
  role: z.enum(['admin', 'editor', 'author', 'contributor']),
});

function provisionalUsername(name: string) {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20) || 'autor';
  return `${base.length < 2 ? 'autor' : base}-${randomToken(3)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, 'x')}`;
}

export async function inviteUser(actor: Actor, input: z.input<typeof inviteSchema>) {
  if (!canManageUsers(actor.role)) throw new UserError('Sem permissão.', 403, 'forbidden');
  const data = inviteSchema.parse(input);
  requireAssignable(actor, data.role);

  const db = await getDb();
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          username: provisionalUsername(data.name),
          name: data.name,
          email: data.email || null,
          role: data.role,
          status: 'invited',
          approvedAt: new Date(),
          approvedBy: actor.id,
        })
        .returning({ id: users.id });
      const token = await issueToken(tx as unknown as Database, user.id, 'invite', actor.id);
      return { userId: user.id, token };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UserError('Já existe um usuário com esse e-mail.', 409, 'exists');
    }
    throw error;
  }
}

export async function regenerateInvite(actor: Actor, id: string) {
  const db = await getDb();
  const target = await requireManageable(db, actor, id);
  if (target.status !== 'invited') {
    throw new UserError('Este usuário já aceitou o convite.', 409, 'not_invited');
  }
  return issueToken(db, id, 'invite', actor.id);
}

export async function createPasswordReset(actor: Actor, id: string) {
  const db = await getDb();
  const target = await requireManageable(db, actor, id);
  if (target.status !== 'active' && target.status !== 'suspended') {
    throw new UserError('Este usuário ainda não definiu uma senha.', 409, 'no_password');
  }
  return issueToken(db, id, 'reset', actor.id);
}

export async function getTokenUser(purpose: 'invite' | 'reset', token: string) {
  if (!token || token.length > 128) return null;
  const db = await getDb();
  const [row] = await db
    .select({ name: users.name, username: users.username, email: users.email })
    .from(userTokens)
    .innerJoin(users, eq(users.id, userTokens.userId))
    .where(
      and(
        eq(userTokens.tokenHash, hashToken(token)),
        eq(userTokens.purpose, purpose),
        isNull(userTokens.usedAt),
        gt(userTokens.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  return row ?? null;
}

// Consome o token dentro da transação: se a gravação falhar (ex.: usuário
// já existe), o link continua válido.
async function consumeToken(tx: Database, purpose: 'invite' | 'reset', token: string) {
  const [row] = await tx
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(userTokens.tokenHash, hashToken(token)),
        eq(userTokens.purpose, purpose),
        isNull(userTokens.usedAt),
        gt(userTokens.expiresAt, sql`now()`),
      ),
    )
    .returning({ userId: userTokens.userId });
  if (!row) throw new UserError('Este link é inválido ou expirou.', 400, 'invalid_token');
  return row.userId;
}

export const acceptInviteSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export async function acceptInvite(token: string, input: z.input<typeof acceptInviteSchema>) {
  const data = acceptInviteSchema.parse(input);
  const passwordHash = await hashPassword(data.password);
  const db = await getDb();

  try {
    await db.transaction(async (tx) => {
      const userId = await consumeToken(tx as unknown as Database, 'invite', token);
      await tx
        .update(users)
        .set({
          name: data.name,
          username: data.username,
          passwordHash,
          status: 'active',
          sessionsValidAfter: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.status, 'invited')));
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UserError('Esse nome de usuário já está em uso.', 409, 'exists');
    }
    throw error;
  }
}

export async function resetPassword(token: string, password: string) {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message, 400, 'weak_password');

  const passwordHash = await hashPassword(password);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const userId = await consumeToken(tx as unknown as Database, 'reset', token);
    await tx
      .update(users)
      .set({ passwordHash, sessionsValidAfter: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  });
}

// ——— Perfil ———

export const profileSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  email: z.union([emailSchema, z.literal('')]),
  bio: z.string().trim().max(500, 'Bio muito longa.'),
  avatarUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === '' || isSafeMediaUrl(value), 'URL de imagem inválida.'),
  // Opcionais: quem não manda (cliente antigo) não apaga o que já existe.
  socials: profileSocialsSchema.optional(),
  readme: readmeSchema.optional(),
});

export async function getProfile(userId: string) {
  const db = await getDb();
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      socials: users.socials,
      readme: users.readme,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ? { ...user, socials: readSocials(user.socials) } : null;
}

// Nome, foto e redes aparecem na página de autor, em /creators e no fim dos posts.
function revalidateAuthorPages() {
  try {
    revalidatePath('/creators');
    revalidatePath('/autores/[username]', 'page');
    revalidatePath('/posts/[slug]', 'page');
  } catch {
    // Fora de uma requisição do Next (scripts, testes): nada a revalidar.
  }
}

export async function updateProfile(userId: string, input: z.input<typeof profileSchema>) {
  const { socials, readme, ...data } = profileSchema.parse(input);
  const db = await getDb();
  try {
    await db
      .update(users)
      .set({
        ...data,
        ...(socials ? { socials } : {}),
        ...(readme !== undefined ? { readme } : {}),
        email: data.email || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UserError('Usuário ou e-mail já em uso por outra conta.', 409, 'exists');
    }
    throw error;
  }
  revalidateAuthorPages();
}

export async function changePassword(userId: string, current: string, next: string) {
  const db = await getDb();
  const user = await findUser(db, userId);
  if (!user?.passwordHash || !(await verifyPassword(current, user.passwordHash))) {
    throw new UserError('Senha atual incorreta.', 400, 'wrong_password');
  }
  const problem = passwordProblem(next);
  if (problem) throw new UserError(problem, 400, 'weak_password');

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(next),
      sessionsValidAfter: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// Autores ativos com acesso ao painel (para o editor escolher o autor de um
// post). Leitores não escrevem, então ficam de fora.
export async function listActiveAuthors() {
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(and(eq(users.status, 'active'), ne(users.role, 'reader')))
    .orderBy(asc(users.name));
}
