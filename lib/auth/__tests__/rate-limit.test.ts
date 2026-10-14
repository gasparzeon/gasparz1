import {
  consumeCommentAttempt,
  consumeLoginAttempt,
  consumeSignupAttempt,
  recordLoginFailure,
  resetLoginFailures,
} from '../rate-limit';
import type { FakeStore } from '@/test/helpers/fake-store';

jest.mock('@/lib/auth/store', () => {
  const { createFakeStore } = jest.requireActual('@/test/helpers/fake-store');
  const store = createFakeStore();
  return { getStore: () => store, __store: store };
});

const { __store: store } = jest.requireMock('@/lib/auth/store') as { __store: FakeStore };

// Início exato de uma janela de 15 minutos, para o teste ser determinístico.
const WINDOW_START = Math.ceil(Date.now() / 900_000) * 900_000;

beforeEach(() => {
  store.data.clear();
  jest.spyOn(Date, 'now').mockReturnValue(WINDOW_START + 1000);
});

async function fail(times: number, ip = '1.1.1.1', user = 'gaspar') {
  for (let i = 0; i < times; i++) {
    await consumeLoginAttempt(ip, user);
    await recordLoginFailure(ip, user);
  }
}

describe('rate limit de login', () => {
  it('bloqueia após 5 falhas do mesmo IP + usuário e informa a espera', async () => {
    await fail(5);

    const result = await consumeLoginAttempt('1.1.1.1', 'gaspar');
    expect(result).toEqual({ allowed: false, retryAfter: 899 });
  });

  it('não confunde usuários nem IPs diferentes', async () => {
    await fail(5);

    await expect(consumeLoginAttempt('2.2.2.2', 'gaspar')).resolves.toEqual({ allowed: true });
    await expect(consumeLoginAttempt('1.1.1.1', 'outro')).resolves.toEqual({ allowed: true });
  });

  it('normaliza o usuário (maiúsculas não contornam o limite)', async () => {
    await fail(5, '1.1.1.1', 'GASPAR');
    await expect(consumeLoginAttempt('1.1.1.1', 'gaspar')).resolves.toMatchObject({
      allowed: false,
    });
  });

  it('login bem-sucedido zera as falhas do IP + usuário', async () => {
    await fail(4);
    await resetLoginFailures('1.1.1.1', 'gaspar');
    await fail(4);

    await expect(consumeLoginAttempt('1.1.1.1', 'gaspar')).resolves.toEqual({ allowed: true });
  });

  it('limita tentativas por IP mesmo sem falhas (protege a CPU do scrypt)', async () => {
    for (let i = 0; i < 30; i++) {
      await expect(consumeLoginAttempt('9.9.9.9', `user-${i}`)).resolves.toEqual({
        allowed: true,
      });
    }
    await expect(consumeLoginAttempt('9.9.9.9', 'mais-um')).resolves.toMatchObject({
      allowed: false,
    });
  });

  it('libera de novo quando a janela vira', async () => {
    await fail(5);
    jest.spyOn(Date, 'now').mockReturnValue(WINDOW_START + 900_000 + 1000);

    await expect(consumeLoginAttempt('1.1.1.1', 'gaspar')).resolves.toEqual({ allowed: true });
  });

  it('não grava o IP nem o usuário em texto puro no store', async () => {
    await fail(1, '203.0.113.7', 'gaspar');
    const keys = Array.from(store.data.keys()).join(' ');
    expect(keys).not.toContain('203.0.113.7');
    expect(keys).not.toContain('gaspar');
  });
});

describe('rate limit de pedidos de acesso', () => {
  it('aceita 5 pedidos por IP por hora e bloqueia o sexto', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(consumeSignupAttempt('7.7.7.7')).resolves.toEqual({ allowed: true });
    }
    await expect(consumeSignupAttempt('7.7.7.7')).resolves.toMatchObject({ allowed: false });
    await expect(consumeSignupAttempt('8.8.8.8')).resolves.toEqual({ allowed: true });
  });
});

describe('rate limit de comentários', () => {
  it('aceita 10 por usuário a cada 10 minutos e bloqueia o 11º', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(consumeCommentAttempt('leitor-1')).resolves.toEqual({ allowed: true });
    }
    const blocked = await consumeCommentAttempt('leitor-1');
    expect(blocked).toMatchObject({ allowed: false });
    if (!blocked.allowed) expect(blocked.retryAfter).toBeGreaterThan(0);
    // Outro usuário não é afetado.
    await expect(consumeCommentAttempt('leitor-2')).resolves.toEqual({ allowed: true });
  });

  it('não grava o id do usuário em texto puro no store', async () => {
    await consumeCommentAttempt('leitor-secreto-1');
    const keys = Array.from(store.data.keys()).join(' ');
    expect(keys).not.toContain('leitor-secreto-1');
  });
});
