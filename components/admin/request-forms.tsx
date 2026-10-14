'use client';

import { useActionState } from 'react';

import {
  requestAgainAction,
  saveRequestNoteAction,
  type RequestFormState,
} from '@/app/admin/pedido/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

const ACTIONS = {
  pending: {
    action: saveRequestNoteAction,
    label: 'Mensagem para quem vai revisar (opcional)',
    submit: 'Salvar mensagem',
    done: 'Mensagem salva.',
  },
  rejected: {
    action: requestAgainAction,
    label: 'Conte mais sobre o que pretende escrever (opcional)',
    submit: 'Pedir de novo',
    done: 'Pedido reenviado.',
  },
} as const;

export function RequestNoteForm({ mode, note }: { mode: 'pending' | 'rejected'; note: string }) {
  // eslint-disable-next-line security/detect-object-injection -- modo tipado
  const config = ACTIONS[mode];
  const [state, action, pending] = useActionState<RequestFormState, FormData>(config.action, {});

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="note">{config.label}</Label>
        <Textarea id="note" name="note" rows={4} maxLength={500} defaultValue={note} />
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {config.done}
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Spinner />}
        {config.submit}
      </Button>
    </form>
  );
}
