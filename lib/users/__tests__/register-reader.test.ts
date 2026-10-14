import { getDb } from '@/lib/db';
import { createFakeDb, type FakeDb } from '@/test/helpers/fake-db';

import { registerReader } from '../service';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/auth/password', () => {
  const actual = jest.requireActual('@/lib/auth/password');
  return { ...actual, hashPassword: jest.fn(async () => 'hash-mock') };
});

const input = {
  name: 'Léo',
  username: 'Leo_Reader',
  email: 'Leo@Example.com',
  password: 'frase-senha-longa',
};

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  (getDb as jest.Mock).mockResolvedValue(fake.db);
});

describe('registerReader (conta de leitor)', () => {
  it('cria ativa como leitor, com usuário e e-mail normalizados', async () => {
    fake.queue('select', [{ value: true }]);
    fake.queue('insert', [{ id: 'novo-id' }]);

    await expect(registerReader(input)).resolves.toEqual({ id: 'novo-id' });
    const [[values]] = fake.argsOf('insert', 'values') as Record<string, unknown>[][];
    expect(values).toMatchObject({
      username: 'leo_reader',
      email: 'leo@example.com',
      name: 'Léo',
      passwordHash: 'hash-mock',
      role: 'reader',
      status: 'active',
    });
  });

  it('com cadastro fechado recusa antes de tocar no banco de usuários', async () => {
    fake.queue('select', [{ value: false }]);
    await expect(registerReader(input)).rejects.toMatchObject({ code: 'closed', status: 403 });
    expect(fake.count('insert')).toBe(0);
  });

  it('duplicado vira 409 com a mensagem pública', async () => {
    fake.queue('select', [{ value: true }]);
    fake.queue('insert', Object.assign(new Error('duplicado'), { code: '23505' }));
    await expect(registerReader(input)).rejects.toMatchObject({
      code: 'exists',
      status: 409,
    });
  });

  it('senha fraca é recusada pela validação', async () => {
    fake.queue('select', [{ value: true }]);
    await expect(registerReader({ ...input, password: 'curta' })).rejects.toThrow(/12 caracteres/);
    expect(fake.count('insert')).toBe(0);
  });
});
