import { revalidatePath } from 'next/cache';

import { getDb } from '@/lib/db';
import { createFakeDb, type FakeDb } from '@/test/helpers/fake-db';

import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '../schema';
import * as service from '../service';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const admin = { id: 'a1', role: 'admin' as const };
const editor = { id: 'e1', role: 'editor' as const };

let fake: FakeDb;

// Fora dos Server Components, o cache() do React não memoiza: cada chamada
// consulta o banco falso de novo.
beforeEach(() => {
  fake = createFakeDb();
  (getDb as jest.Mock).mockResolvedValue(fake.db);
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
});

const changed = (patch: (settings: SiteSettings) => void) => {
  const settings = structuredClone(DEFAULT_SITE_SETTINGS);
  patch(settings);
  return settings;
};

describe('getSiteSettings (site público)', () => {
  it('sem nada salvo, usa os padrões', async () => {
    fake.queue('select', []);
    await expect(service.getSiteSettings()).resolves.toEqual(DEFAULT_SITE_SETTINGS);
  });

  it('instalação nova com NEXT_PUBLIC_PLAUSIBLE_DOMAIN liga o Plausible', async () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = 'gaspar.vorn.fun';
    fake.queue('select', []);
    const settings = await service.getSiteSettings();
    expect(settings.integrations.plausible).toMatchObject({
      enabled: true,
      domain: 'gaspar.vorn.fun',
    });
  });

  it('o que está salvo vence a variável de ambiente', async () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = 'gaspar.vorn.fun';
    fake.queue('select', [{ value: { general: { name: 'Outro' } }, updatedAt: new Date() }]);
    const settings = await service.getSiteSettings();
    expect(settings.general.name).toBe('Outro');
    expect(settings.integrations.plausible.enabled).toBe(false);
  });

  it('se o banco falhar, o site sai com os padrões em vez de quebrar', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getDb as jest.Mock).mockRejectedValueOnce(new Error('sem DATABASE_URL'));
    await expect(service.getSiteSettings()).resolves.toEqual(DEFAULT_SITE_SETTINGS);
    expect(error).toHaveBeenCalled();
  });
});

describe('painel', () => {
  it('só administradores leem e salvam', async () => {
    await expect(service.getSiteSettingsForAdmin(editor)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.saveSiteSettings(editor, DEFAULT_SITE_SETTINGS, null),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(fake.calls).toHaveLength(0);
  });

  it('devolve a data da versão salva para detectar conflitos', async () => {
    const updatedAt = new Date('2026-10-13T10:00:00.000Z');
    fake.queue('select', [{ value: DEFAULT_SITE_SETTINGS, updatedAt }]);
    await expect(service.getSiteSettingsForAdmin(admin)).resolves.toEqual({
      settings: DEFAULT_SITE_SETTINGS,
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('salva, grava a data e manda o site regenerar', async () => {
    fake.queue('select', []);
    const next = changed((settings) => {
      settings.general.name = 'Novo Nome';
    });

    const result = await service.saveSiteSettings(admin, next, null);

    expect(result.settings.general.name).toBe('Novo Nome');
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const [[values]] = fake.argsOf('insert', 'values') as [[{ key: string; value: SiteSettings }]];
    expect(values).toMatchObject({ key: 'site', value: { general: { name: 'Novo Nome' } } });
    expect(fake.argsOf('insert', 'onConflictDoUpdate')).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('recusa salvar por cima da edição de outra pessoa', async () => {
    fake.queue('select', [
      { value: DEFAULT_SITE_SETTINGS, updatedAt: new Date('2026-10-13T11:00:00Z') },
    ]);
    await expect(
      service.saveSiteSettings(admin, DEFAULT_SITE_SETTINGS, '2026-10-13T10:00:00.000Z'),
    ).rejects.toMatchObject({ status: 409, code: 'conflict' });
    expect(fake.count('insert')).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('valida antes de gravar (links perigosos não passam)', async () => {
    const bad = changed((settings) => {
      settings.navigation.links = [{ label: 'X', href: 'javascript:alert(1)' }];
    });
    await expect(service.saveSiteSettings(admin, bad, null)).rejects.toThrow();
    expect(fake.count('insert')).toBe(0);
  });
});
