import { SignJWT } from 'jose';

import { API_AUDIENCE, AUTH_ISSUER } from '../config';
import { getKeys } from '../crypto';
import { seal, signAccessToken, unseal, verifyAccessToken } from '../tokens';

const now = () => Math.floor(Date.now() / 1000);

describe('access token (JWT HS256)', () => {
  it('assina e valida com issuer, audience e typ at+jwt', async () => {
    const { token, expiresAt } = await signAccessToken({
      sub: 'gaspar',
      sid: 'sessao-1',
      scope: 'posts:write',
    });

    const claims = await verifyAccessToken(token);
    expect(claims).toMatchObject({ sub: 'gaspar', sid: 'sessao-1', scope: 'posts:write' });
    expect(expiresAt - now()).toBeGreaterThan(14 * 60);

    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    expect(header).toEqual({ alg: 'HS256', typ: 'at+jwt' });
  });

  it('rejeita token adulterado', async () => {
    const { token } = await signAccessToken({ sub: 'gaspar', sid: 's', scope: 'posts:write' });
    const [header, payload, signature] = token.split('.');
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString());
    forged.sub = 'atacante';
    const tampered = [header, Buffer.from(JSON.stringify(forged)).toString('base64url'), signature];

    await expect(verifyAccessToken(tampered.join('.'))).resolves.toBeNull();
  });

  it('rejeita token expirado', async () => {
    const expired = await new SignJWT({ sid: 's', scope: 'posts:write' })
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
      .setIssuer(AUTH_ISSUER)
      .setAudience(API_AUDIENCE)
      .setSubject('gaspar')
      .setJti('x')
      .setIssuedAt(now() - 3600)
      .setExpirationTime(now() - 60)
      .sign(getKeys().signing);

    await expect(verifyAccessToken(expired)).resolves.toBeNull();
  });

  it('rejeita alg "none" e audience diferente', async () => {
    const none = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'at+jwt' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'gaspar', sid: 's', scope: 'x' })).toString('base64url'),
      '',
    ].join('.');
    await expect(verifyAccessToken(none)).resolves.toBeNull();

    const otherAudience = await new SignJWT({ sid: 's', scope: 'posts:write' })
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
      .setIssuer(AUTH_ISSUER)
      .setAudience('outra-api')
      .setSubject('gaspar')
      .setJti('x')
      .setExpirationTime('5m')
      .sign(getKeys().signing);
    await expect(verifyAccessToken(otherAudience)).resolves.toBeNull();
  });
});

describe('seal/unseal (JWE A256GCM)', () => {
  it('cifra o conteúdo (opaco para o cliente) e devolve os dados', async () => {
    const token = await seal('code', { sub: 'gaspar', cc: 'desafio' }, now() + 60);
    expect(token).not.toContain('gaspar');

    await expect(unseal('code', token)).resolves.toMatchObject({ sub: 'gaspar', cc: 'desafio' });
  });

  it('não aceita um valor selado para outro propósito', async () => {
    const code = await seal('code', { sub: 'gaspar' }, now() + 60);
    await expect(unseal('refresh', code)).resolves.toBeNull();
  });

  it('expira no horário definido', async () => {
    const token = await seal('refresh', { sid: 's' }, now() - 1);
    await expect(unseal('refresh', token)).resolves.toBeNull();
  });

  it('rejeita lixo e valores cifrados com outro segredo', async () => {
    await expect(unseal('tx', 'não-é-um-jwe')).resolves.toBeNull();

    const token = await seal('tx', { state: 'x' }, now() + 60);
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = 'segredo-totalmente-diferente-com-32-chars!!';
    try {
      await expect(unseal('tx', token)).resolves.toBeNull();
    } finally {
      process.env.AUTH_SECRET = original;
    }
  });
});
