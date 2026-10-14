import 'server-only';

import { cache } from 'react';
import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { canManageSite, type Actor } from '@/lib/auth/permissions';
import { getDb, type Database } from '@/lib/db';
import { pages, users, type Page } from '@/lib/db/schema';

import {
  pageBlockSchema,
  pageInputSchema,
  type PageBlock,
  type PageDocument,
  type PageInput,
  type PageStatus,
  type PageSummary,
} from './pages-schema';

export class PageError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
    readonly code?: 'forbidden' | 'not_found' | 'conflict' | 'exists',
  ) {
    super(message);
    this.name = 'PageError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Blocos vêm de jsonb: um bloco inválido (versão antiga, edição manual no
// banco) é descartado em vez de derrubar a página.
export function parseBlocks(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((block) => {
    const parsed = pageBlockSchema.safeParse(block);
    return parsed.success ? [parsed.data] : [];
  });
}

type Row = Page & { updaterName: string | null };

const columns = {
  id: pages.id,
  slug: pages.slug,
  title: pages.title,
  description: pages.description,
  blocks: pages.blocks,
  showBackLink: pages.showBackLink,
  status: pages.status,
  updatedBy: pages.updatedBy,
  version: pages.version,
  createdAt: pages.createdAt,
  updatedAt: pages.updatedAt,
  updaterName: users.name,
};

function toDocument(row: Row): PageDocument {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    blocks: parseBlocks(row.blocks),
    showBackLink: row.showBackLink,
    status: row.status,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ? { id: row.updatedBy, name: row.updaterName ?? '' } : null,
  };
}

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code === '23505' || err?.cause?.code === '23505';
}

function requireManager(actor: Actor) {
  if (!canManageSite(actor.role)) {
    throw new PageError('Só administradores editam as páginas do site.', 403, 'forbidden');
  }
}

function revalidatePublicSite() {
  try {
    revalidatePath('/', 'layout');
  } catch {
    // Fora de uma requisição do Next (scripts, testes): nada a revalidar.
  }
}

async function findPage(db: Database, id: string): Promise<Row | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select(columns)
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .where(eq(pages.id, id))
    .limit(1);
  return (row as Row | undefined) ?? null;
}

// ——— Painel ———

export async function listPagesForAdmin(actor: Actor): Promise<PageSummary[]> {
  requireManager(actor);
  const db = await getDb();
  const rows = await db
    .select(columns)
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .orderBy(asc(pages.title));

  return (rows as Row[]).map((row) => {
    const { id, slug, title, status, version, updatedAt, updatedBy } = toDocument(row);
    return { id, slug, title, status, version, updatedAt, updatedBy };
  });
}

export async function getPageForEditor(actor: Actor, id: string): Promise<PageDocument> {
  requireManager(actor);
  const row = await findPage(await getDb(), id);
  if (!row) throw new PageError('Página não encontrada.', 404, 'not_found');
  return toDocument(row);
}

export async function createPage(actor: Actor, input: PageInput, status: PageStatus) {
  requireManager(actor);
  const data = pageInputSchema.parse(input);
  const db = await getDb();

  let id: string;
  try {
    const [created] = await db
      .insert(pages)
      .values({ ...data, status, updatedBy: actor.id })
      .returning({ id: pages.id });
    id = created.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PageError('Já existe uma página com esse endereço.', 409, 'exists');
    }
    throw error;
  }

  if (status === 'published') revalidatePublicSite();
  return getPageForEditor(actor, id);
}

export async function updatePage(
  actor: Actor,
  id: string,
  input: PageInput,
  status: PageStatus,
  expectedVersion: number,
) {
  requireManager(actor);
  const data = pageInputSchema.parse(input);
  const db = await getDb();

  const current = await findPage(db, id);
  if (!current) throw new PageError('Página não encontrada.', 404, 'not_found');

  let updated: { id: string }[];
  try {
    updated = await db
      .update(pages)
      .set({
        ...data,
        status,
        updatedBy: actor.id,
        version: sql`${pages.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(pages.id, id), eq(pages.version, expectedVersion)))
      .returning({ id: pages.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PageError('Já existe uma página com esse endereço.', 409, 'exists');
    }
    throw error;
  }

  if (updated.length === 0) {
    throw new PageError('Alguém salvou esta página depois que você a abriu.', 409, 'conflict');
  }

  if (current.status === 'published' || status === 'published') revalidatePublicSite();
  return getPageForEditor(actor, id);
}

export async function deletePage(actor: Actor, id: string, expectedVersion: number) {
  requireManager(actor);
  const db = await getDb();

  const current = await findPage(db, id);
  if (!current) throw new PageError('Página não encontrada.', 404, 'not_found');

  const deleted = await db
    .delete(pages)
    .where(and(eq(pages.id, id), eq(pages.version, expectedVersion)))
    .returning({ id: pages.id });
  if (deleted.length === 0) {
    throw new PageError('Alguém salvou esta página depois que você a abriu.', 409, 'conflict');
  }

  if (current.status === 'published') revalidatePublicSite();
}

// ——— Site público ———

export const getPublishedPage = cache(async (slug: string): Promise<PageDocument | null> => {
  const db = await getDb();
  const [row] = await db
    .select(columns)
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .where(and(eq(pages.slug, slug), eq(pages.status, 'published')))
    .limit(1);
  return row ? toDocument(row as Row) : null;
});

export const listPublishedPages = cache(
  async (): Promise<{ slug: string; updatedAt: string }[]> => {
    const db = await getDb();
    const rows = await db
      .select({ slug: pages.slug, updatedAt: pages.updatedAt })
      .from(pages)
      .where(eq(pages.status, 'published'))
      .orderBy(asc(pages.slug));
    return rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() }));
  },
);
