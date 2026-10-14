import 'server-only';

import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { canManageSite, type Actor } from '@/lib/auth/permissions';
import { getDb } from '@/lib/db';
import { settings } from '@/lib/db/schema';

import {
  DEFAULT_SITE_SETTINGS,
  siteSettingsSchema,
  withDefaults,
  type SiteSettings,
} from './schema';

const SITE_KEY = 'site';

export class SiteError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
    readonly code?: 'forbidden' | 'not_found' | 'conflict' | 'exists',
  ) {
    super(message);
    this.name = 'SiteError';
  }
}

export type SiteSettingsDocument = { settings: SiteSettings; updatedAt: string | null };

// Instalação nova (nada salvo ainda): o Plausible configurado por variável de
// ambiente continua funcionando até alguém mexer nas integrações.
function freshInstallDefaults(): SiteSettings {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) return DEFAULT_SITE_SETTINGS;
  return withDefaults({
    integrations: {
      plausible: { ...DEFAULT_SITE_SETTINGS.integrations.plausible, enabled: true, domain },
    },
  });
}

async function readDocument(): Promise<SiteSettingsDocument> {
  const db = await getDb();
  const [row] = await db
    .select({ value: settings.value, updatedAt: settings.updatedAt })
    .from(settings)
    .where(eq(settings.key, SITE_KEY))
    .limit(1);

  if (!row) return { settings: freshInstallDefaults(), updatedAt: null };
  return { settings: withDefaults(row.value), updatedAt: row.updatedAt.toISOString() };
}

// Site público: memoizado por requisição. Sem banco (ex.: Vercel sem
// DATABASE_URL), o site sai com os padrões em vez de quebrar inteiro — a tela
// de login precisa abrir para mostrar o erro de configuração.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    return (await readDocument()).settings;
  } catch (error) {
    console.error('[site] usando configurações padrão; o banco falhou:', error);
    return DEFAULT_SITE_SETTINGS;
  }
});

function requireManager(actor: Actor) {
  if (!canManageSite(actor.role)) {
    throw new SiteError('Só administradores alteram o site.', 403, 'forbidden');
  }
}

export async function getSiteSettingsForAdmin(actor: Actor): Promise<SiteSettingsDocument> {
  requireManager(actor);
  return readDocument();
}

function revalidatePublicSite() {
  try {
    revalidatePath('/', 'layout');
  } catch {
    // Fora de uma requisição do Next (scripts, testes): nada a revalidar.
  }
}

export async function saveSiteSettings(
  actor: Actor,
  input: unknown,
  expectedUpdatedAt: string | null,
): Promise<SiteSettingsDocument> {
  requireManager(actor);
  const next = siteSettingsSchema.parse(input);

  const current = await readDocument();
  if (current.updatedAt !== expectedUpdatedAt) {
    throw new SiteError(
      'Outra pessoa salvou as configurações depois que você abriu esta página.',
      409,
      'conflict',
    );
  }

  const updatedAt = new Date();
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: SITE_KEY, value: next, updatedAt })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt } });

  revalidatePublicSite();
  return { settings: next, updatedAt: updatedAt.toISOString() };
}
