'use client';

import { useActionState, useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';

import { authorize, type LoginState } from '@/app/admin/login/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type OAuthFields = Record<string, string>;

function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}min ${rest}s` : `${minutes}min`;
}

export function LoginForm({ oauth }: { oauth: OAuthFields }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(authorize, {});
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [wait, setWait] = useState(0);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!state.redirectTo) return;
    setRedirecting(true);
    // Navegação completa: o callback precisa rodar uma única vez.
    window.location.replace(state.redirectTo);
  }, [state.redirectTo]);

  useEffect(() => {
    if (!state.retryAfter) return;
    setWait(state.retryAfter);
    const timer = window.setInterval(() => {
      setWait((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  const busy = pending || redirecting;
  const detectCapsLock = (event: React.KeyboardEvent) =>
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {Object.entries(oauth).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="space-y-2">
        <Label htmlFor="username">Usuário ou e-mail</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={busy}
          className="h-10"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={busy}
            onKeyDown={detectCapsLock}
            onKeyUp={detectCapsLock}
            className="h-10 pr-10"
            aria-describedby={capsLock ? 'caps-lock-hint' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock && (
          <p id="caps-lock-hint" className="text-xs text-yellow-700 dark:text-yellow-400">
            Caps Lock está ativado.
          </p>
        )}
      </div>

      {state.error && !redirecting && (
        <p
          role="alert"
          className="rounded-sm border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
          {wait > 0 && <> Tente em {formatWait(wait)}.</>}
        </p>
      )}

      <Button type="submit" className="h-10 w-full" disabled={busy || wait > 0}>
        {busy ? (
          <>
            <Spinner />
            {redirecting ? 'Entrando…' : 'Verificando…'}
          </>
        ) : (
          <>
            Entrar
            <ArrowRight />
          </>
        )}
      </Button>

      <p className="flex items-center gap-1.5 pt-1 font-mono text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        OAuth 2.0 · Authorization Code + PKCE
      </p>
    </form>
  );
}
