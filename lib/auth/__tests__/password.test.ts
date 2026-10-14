import * as nodeCrypto from 'node:crypto';

import { burnPasswordCheck, hashPassword, passwordProblem, verifyPassword } from '../password';
import { fastHash } from '@/test/helpers/password';

// Espiona o scrypt real para provar que a verificação "falsa" gasta o
// mesmo trabalho de uma verdadeira.
jest.mock('node:crypto', () => {
  const actual = jest.requireActual('node:crypto');
  return { ...actual, scrypt: jest.fn(actual.scrypt) };
});

const scryptSpy = nodeCrypto.scrypt as unknown as jest.Mock;

describe('hashPassword', () => {
  it('gera hash scrypt com parâmetros OWASP e sal aleatório', async () => {
    const a = await hashPassword('frase senha bem longa');
    const b = await hashPassword('frase senha bem longa');

    expect(a).toMatch(/^scrypt:131072:8:1:[\w-]{22}:[\w-]{86}$/);
    expect(a).not.toBe(b);
    await expect(verifyPassword('frase senha bem longa', a)).resolves.toBe(true);
  });
});

describe('verifyPassword', () => {
  const hash = fastHash('frase senha bem longa');

  it('aceita a senha correta e recusa a errada', async () => {
    await expect(verifyPassword('frase senha bem longa', hash)).resolves.toBe(true);
    await expect(verifyPassword('frase senha bem longA', hash)).resolves.toBe(false);
  });

  it('normaliza Unicode (NFKC) antes de derivar', async () => {
    const composed = fastHash('ação');
    await expect(verifyPassword('ação', composed)).resolves.toBe(true);
  });

  it.each([
    ['formato desconhecido', 'bcrypt$2b$10$abc'],
    ['N que não é potência de 2', 'scrypt:30000:8:1:c2FsdA:' + 'a'.repeat(86)],
    ['N alto demais (DoS de memória)', 'scrypt:2097152:8:1:c2FsdA:' + 'a'.repeat(86)],
    ['hash curto', 'scrypt:16384:8:1:c2FsdA:YWJj'],
  ])('recusa %s sem lançar erro', async (_label, encoded) => {
    await expect(verifyPassword('qualquer', encoded)).resolves.toBe(false);
  });
});

describe('burnPasswordCheck', () => {
  it('roda o scrypt e sempre falha (usuário inexistente leva o mesmo tempo)', async () => {
    scryptSpy.mockClear();
    await expect(burnPasswordCheck('qualquer')).resolves.toBe(false);
    expect(scryptSpy).toHaveBeenCalledTimes(1);
    expect(scryptSpy.mock.calls[0][3]).toMatchObject({ N: 131072 });
  });
});

describe('passwordProblem', () => {
  it('exige ao menos 12 caracteres', () => {
    expect(passwordProblem('curta')).toMatch(/12 caracteres/);
    expect(passwordProblem('uma frase bem longa')).toBeNull();
    expect(passwordProblem('x'.repeat(1025))).toMatch(/longa demais/);
  });
});
