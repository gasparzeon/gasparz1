import { getKeys, pkceChallenge, randomToken, safeEqual } from '../crypto';
import { AuthConfigError } from '../config';

describe('pkceChallenge', () => {
  it('segue o vetor de teste da RFC 7636 (apêndice B)', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('safeEqual', () => {
  it('compara strings de tamanhos diferentes sem lançar erro', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});

describe('randomToken', () => {
  it('gera tokens base64url distintos com a entropia pedida', () => {
    const a = randomToken(32);
    const b = randomToken(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe('getKeys', () => {
  const original = process.env.AUTH_SECRET;
  afterEach(() => {
    process.env.AUTH_SECRET = original;
  });

  it('exige AUTH_SECRET com pelo menos 32 caracteres', () => {
    process.env.AUTH_SECRET = 'curto';
    expect(() => getKeys()).toThrow(AuthConfigError);
  });

  it('deriva chaves diferentes para assinatura e cifragem', () => {
    const keys = getKeys();
    expect(keys.signing).toHaveLength(32);
    expect(keys.encryption).toHaveLength(32);
    expect(Buffer.from(keys.signing).equals(Buffer.from(keys.encryption))).toBe(false);
  });

  it('troca as chaves quando o segredo muda (revogação global)', () => {
    const before = getKeys().signing;
    process.env.AUTH_SECRET = 'outro-segredo-com-mais-de-32-caracteres-xyz';
    expect(Buffer.from(getKeys().signing).equals(Buffer.from(before))).toBe(false);
  });
});
