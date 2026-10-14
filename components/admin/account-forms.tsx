'use client';

import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import {
  acceptInviteAction,
  requestAccessAction,
  resetPasswordAction,
  type AccountFormState,
} from '@/app/admin/account-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

function Field({
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{label}</Label>
      <Input className="h-10" {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ErrorMessage({ state }: { state: AccountFormState }) {
  if (!state.error) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {state.error}
    </p>
  );
}

function Success({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-700 dark:text-emerald-400" />
      <h2 className="gz-h3 mb-2 font-mono">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function PasswordFields() {
  return (
    <>
      <Field
        id="password"
        name="password"
        type="password"
        label="Senha"
        required
        minLength={12}
        autoComplete="new-password"
        hint="Mínimo de 12 caracteres. Uma frase longa é o ideal."
      />
      <Field
        id="confirm"
        name="confirm"
        type="password"
        label="Confirmar senha"
        required
        minLength={12}
        autoComplete="new-password"
      />
    </>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(requestAccessAction, {});

  if (state.ok) {
    return (
      <Success title="Conta criada">
        <p className="mb-6">
          Você já pode comentar nos posts. Para escrever, um administrador precisa promover sua
          conta.
        </p>
        <a
          href="/api/auth/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </a>
      </Success>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field
        id="name"
        name="name"
        label="Nome"
        required
        defaultValue={state.fields?.name}
        autoFocus
      />
      <Field
        id="username"
        name="username"
        label="Usuário"
        required
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.fields?.username}
        hint="Letras minúsculas, números, - ou _. Aparece junto dos seus comentários."
      />
      <Field
        id="email"
        name="email"
        type="email"
        label="E-mail"
        required
        autoComplete="email"
        defaultValue={state.fields?.email}
      />
      <PasswordFields />
      <ErrorMessage state={state} />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Spinner />}
        Criar conta
      </Button>
    </form>
  );
}

export function AcceptInviteForm({
  token,
  name,
  username,
}: {
  token: string;
  name: string;
  username: string;
}) {
  const [state, action, pending] = useActionState(acceptInviteAction, {});

  if (state.ok) {
    return (
      <Success title="Conta criada">
        <p className="mb-6">Tudo pronto. Agora é só entrar.</p>
        <a
          href="/api/auth/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </a>
      </Success>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field
        id="name"
        name="name"
        label="Nome"
        required
        defaultValue={state.fields?.name ?? name}
      />
      <Field
        id="username"
        name="username"
        label="Usuário"
        required
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.fields?.username ?? username}
        hint="Letras minúsculas, números, - ou _."
      />
      <PasswordFields />
      <ErrorMessage state={state} />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Spinner />}
        Criar minha conta
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {});

  if (state.ok) {
    return (
      <Success title="Senha redefinida">
        <p className="mb-6">As sessões antigas foram encerradas. Entre com a nova senha.</p>
        <a
          href="/api/auth/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar
        </a>
      </Success>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordFields />
      <ErrorMessage state={state} />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Spinner />}
        Salvar nova senha
      </Button>
    </form>
  );
}
