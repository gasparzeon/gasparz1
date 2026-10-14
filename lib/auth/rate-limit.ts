import 'server-only';

import { sha256 } from './crypto';
import { getStore } from './store';

// Limites de tentativas de login em janelas fixas:
// - ip:      tentativas por IP (protege CPU, já que cada uma roda scrypt)
// - ipUser:  falhas por IP + usuário
// - user:    falhas globais no usuário (ataque distribuído)
const RULES = {
  ip: { limit: 30, window: 15 * 60 },
  ipUser: { limit: 5, window: 15 * 60 },
  user: { limit: 100, window: 60 * 60 },
} as const;

type RuleName = keyof typeof RULES;

function windowKey(rule: RuleName, subject: string) {
  // eslint-disable-next-line security/detect-object-injection -- chave tipada (união literal do código), não vem de entrada externa
  const { window } = RULES[rule];
  const slot = Math.floor(Date.now() / 1000 / window);
  const id = sha256(subject).toString('base64url').slice(0, 32);
  return { key: `rl:${rule}:${id}:${slot}`, resetAt: (slot + 1) * window };
}

function subjects(ip: string, username: string) {
  const user = username.normalize('NFKC').toLowerCase();
  return {
    ip: ip,
    ipUser: `${ip}|${user}`,
    user,
  } satisfies Record<RuleName, string>;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };

// Conta a tentativa no limite por IP e verifica os limites de falha.
export async function consumeLoginAttempt(ip: string, username: string): Promise<RateLimitResult> {
  const store = getStore();
  const now = Math.floor(Date.now() / 1000);
  const subject = subjects(ip, username);

  const ipWindow = windowKey('ip', subject.ip);
  const failureWindows = [
    { rule: 'ipUser' as const, ...windowKey('ipUser', subject.ipUser) },
    { rule: 'user' as const, ...windowKey('user', subject.user) },
  ];

  const [ipCount, ...failures] = await Promise.all([
    store.incr(ipWindow.key, RULES.ip.window),
    ...failureWindows.map((w) => store.get(w.key)),
  ]);

  const blocked: number[] = [];
  if (ipCount > RULES.ip.limit) blocked.push(ipWindow.resetAt);

  failureWindows.forEach((w, index) => {
    // eslint-disable-next-line security/detect-object-injection -- índice numérico do próprio array e chave tipada
    if (Number(failures[index] ?? 0) >= RULES[w.rule].limit) {
      blocked.push(w.resetAt);
    }
  });

  if (blocked.length > 0) {
    return { allowed: false, retryAfter: Math.max(...blocked) - now };
  }

  return { allowed: true };
}

export async function recordLoginFailure(ip: string, username: string) {
  const store = getStore();
  const subject = subjects(ip, username);

  await Promise.all(
    (['ipUser', 'user'] as const).map((rule) =>
      // eslint-disable-next-line security/detect-object-injection -- chave tipada (união literal do código), não vem de entrada externa
      store.incr(windowKey(rule, subject[rule]).key, RULES[rule].window),
    ),
  );
}

export async function resetLoginFailures(ip: string, username: string) {
  const subject = subjects(ip, username);
  await getStore().del(windowKey('ipUser', subject.ipUser).key);
}

const SIGNUP_LIMIT = { limit: 5, window: 60 * 60 };

// Pedidos de acesso por IP (cada um roda scrypt e cria uma conta pendente).
export async function consumeSignupAttempt(ip: string): Promise<RateLimitResult> {
  const slot = Math.floor(Date.now() / 1000 / SIGNUP_LIMIT.window);
  const id = sha256(ip).toString('base64url').slice(0, 32);
  const count = await getStore().incr(`rl:signup:${id}:${slot}`, SIGNUP_LIMIT.window);

  if (count > SIGNUP_LIMIT.limit) {
    return {
      allowed: false,
      retryAfter: (slot + 1) * SIGNUP_LIMIT.window - Math.floor(Date.now() / 1000),
    };
  }
  return { allowed: true };
}

const COMMENT_LIMIT = { limit: 10, window: 10 * 60 };

// Comentários por usuário (logado): freia flood sem punir conversa normal.
export async function consumeCommentAttempt(userId: string): Promise<RateLimitResult> {
  const slot = Math.floor(Date.now() / 1000 / COMMENT_LIMIT.window);
  const id = sha256(userId).toString('base64url').slice(0, 32);
  const count = await getStore().incr(`rl:comment:${id}:${slot}`, COMMENT_LIMIT.window);

  if (count > COMMENT_LIMIT.limit) {
    return {
      allowed: false,
      retryAfter: (slot + 1) * COMMENT_LIMIT.window - Math.floor(Date.now() / 1000),
    };
  }
  return { allowed: true };
}
