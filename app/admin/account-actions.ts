'use server';

import { headers } from 'next/headers';
import { ZodError } from 'zod';

import { consumeSignupAttempt } from '@/lib/auth/rate-limit';
import { getClientIp } from '@/lib/auth/session';
import { UserError, acceptInvite, registerReader, resetPassword } from '@/lib/users/service';

export type AccountFormState = {
  ok?: boolean;
  error?: string;
  fields?: Record<string, string>;
};

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

function failure(error: unknown, fields?: Record<string, string>): AccountFormState {
  if (error instanceof ZodError)
    return { error: error.issues[0]?.message ?? 'Dados inválidos.', fields };
  if (error instanceof UserError) return { error: error.message, fields };
  console.error('[conta] erro inesperado:', error);
  return { error: 'Não foi possível concluir agora. Tente novamente.', fields };
}

export async function requestAccessAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const fields = {
    name: text(formData, 'name'),
    username: text(formData, 'username'),
    email: text(formData, 'email'),
  };

  try {
    const limit = await consumeSignupAttempt(getClientIp(await headers()));
    if (!limit.allowed) {
      return { error: 'Muitas contas criadas deste endereço. Tente mais tarde.', fields };
    }
    if (text(formData, 'password') !== text(formData, 'confirm')) {
      return { error: 'A confirmação não confere com a senha.', fields };
    }
    await registerReader({ ...fields, password: text(formData, 'password') });
    return { ok: true };
  } catch (error) {
    return failure(error, fields);
  }
}

export async function acceptInviteAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const fields = { name: text(formData, 'name'), username: text(formData, 'username') };

  try {
    if (text(formData, 'password') !== text(formData, 'confirm')) {
      return { error: 'A confirmação não confere com a senha.', fields };
    }
    await acceptInvite(text(formData, 'token'), {
      ...fields,
      password: text(formData, 'password'),
    });
    return { ok: true };
  } catch (error) {
    return failure(error, fields);
  }
}

export async function resetPasswordAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  try {
    if (text(formData, 'password') !== text(formData, 'confirm')) {
      return { error: 'A confirmação não confere com a senha.' };
    }
    await resetPassword(text(formData, 'token'), text(formData, 'password'));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
