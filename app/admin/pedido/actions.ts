'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';

import { REQUEST_PATH } from '@/lib/auth/config';
import { clearRequestTicket, readRequestTicket } from '@/lib/auth/request-ticket';
import { UserError, requestAccessAgain, updateRequestNote } from '@/lib/users/service';

export type RequestFormState = { ok?: boolean; error?: string };

const EXPIRED = 'Seu acesso a esta página expirou. Entre de novo com usuário e senha.';

const noteOf = (formData: FormData) => {
  const value = formData.get('note');
  return typeof value === 'string' ? value : '';
};

function failure(error: unknown): RequestFormState {
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? 'Dados inválidos.' };
  if (error instanceof UserError) return { error: error.message };
  console.error('[pedido] erro inesperado:', error);
  return { error: 'Não foi possível concluir agora. Tente novamente.' };
}

// O ticket (cookie cifrado) é a única credencial aceita aqui: identifica a
// conta que acabou de provar a senha e não dá acesso a mais nada do painel.
export async function saveRequestNoteAction(
  _previous: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const userId = await readRequestTicket();
  if (!userId) return { error: EXPIRED };

  try {
    await updateRequestNote(userId, noteOf(formData));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function requestAgainAction(
  _previous: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const userId = await readRequestTicket();
  if (!userId) return { error: EXPIRED };

  try {
    await requestAccessAgain(userId, noteOf(formData));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(REQUEST_PATH);
  return { ok: true };
}

export async function leaveRequestAction() {
  await clearRequestTicket();
  redirect('/');
}
