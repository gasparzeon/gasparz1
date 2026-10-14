import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';

import { getDb } from '@/lib/db';
import { createFakeDb, type FakeDb } from '@/test/helpers/fake-db';

import { getProfile, updateProfile } from '../service';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const ID = '0b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';
const base = {
  name: 'Gaspar',
  username: 'Gaspar',
  email: '',
  bio: 'Pesquisa e investigação.',
  avatarUrl: '',
};

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  (getDb as jest.Mock).mockResolvedValue(fake.db);
});

const updated = () => (fake.argsOf('update', 'set')[0]?.[0] ?? {}) as Record<string, unknown>;

describe('getProfile', () => {
  it('devolve as redes conferidas (lixo salvo no banco não passa)', async () => {
    fake.queue('select', [
      {
        id: ID,
        name: 'Gaspar',
        username: 'gaspar',
        email: null,
        bio: '',
        avatarUrl: '',
        role: 'owner',
        readme: '### Sobre mim',
        socials: [
          { network: 'x', url: 'https://x.com/gasparzeon', label: '' },
          { network: 'instagram', url: 'https://evil.com/gaspar' },
        ],
      },
    ]);
    const profile = await getProfile(ID);
    expect(profile?.readme).toBe('### Sobre mim');
    expect(profile?.socials).toEqual([
      { network: 'x', handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' },
    ]);
  });

  it('usuário que não existe → null', async () => {
    fake.queue('select', []);
    await expect(getProfile(ID)).resolves.toBeNull();
  });
});

describe('updateProfile', () => {
  it('salva as redes com o link oficial montado e atualiza as páginas públicas', async () => {
    await updateProfile(ID, {
      ...base,
      socials: [
        { network: 'tiktok', value: 'https://www.tiktok.com/@gaspar_labs?lang=pt', label: '' },
        { network: 'spotify', value: '' },
      ],
    });

    expect(updated()).toMatchObject({
      username: 'gaspar',
      email: null,
      socials: [
        {
          network: 'tiktok',
          handle: 'gaspar_labs',
          url: 'https://www.tiktok.com/@gaspar_labs',
          label: '',
        },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/creators');
    expect(revalidatePath).toHaveBeenCalledWith('/autores/[username]', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/posts/[slug]', 'page');
  });

  it('sem a lista de redes (cliente antigo), não apaga as que já existem', async () => {
    await updateProfile(ID, base);
    expect(updated()).not.toHaveProperty('socials');
  });

  it('lista vazia remove todas as redes', async () => {
    await updateProfile(ID, { ...base, socials: [] });
    expect(updated()).toMatchObject({ socials: [] });
  });

  it('link que não é da rede: erro de validação e nada é gravado', async () => {
    await expect(
      updateProfile(ID, {
        ...base,
        socials: [{ network: 'instagram', value: 'https://evil.com/gaspar', label: '' }],
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(fake.count('update')).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('README: salvo limpo (sem espaços nas pontas); sem o campo, fica como estava', async () => {
    await updateProfile(ID, { ...base, readme: '  ### Sobre mim\r\nPesquiso urnas.  \n' });
    expect(updated()).toMatchObject({ readme: '### Sobre mim\nPesquiso urnas.' });

    fake = createFakeDb();
    (getDb as jest.Mock).mockResolvedValue(fake.db);
    await updateProfile(ID, base);
    expect(updated()).not.toHaveProperty('readme');
  });

  it('README acima do limite: erro de validação e nada é gravado', async () => {
    await expect(updateProfile(ID, { ...base, readme: 'x'.repeat(1201) })).rejects.toThrow(
      /1\.200 caracteres/,
    );
    expect(fake.count('update')).toBe(0);
  });

  it('usuário ou e-mail já usados → 409', async () => {
    fake.queue('update', Object.assign(new Error('duplicado'), { code: '23505' }));
    await expect(updateProfile(ID, base)).rejects.toMatchObject({ status: 409, code: 'exists' });
  });

  it('fora de uma requisição do Next, revalidar não derruba o salvamento', async () => {
    (revalidatePath as jest.Mock).mockImplementation(() => {
      throw new Error('static generation store missing');
    });
    await expect(updateProfile(ID, base)).resolves.toBeUndefined();
  });
});
