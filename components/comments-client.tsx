'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { adminFetch, ApiError } from '@/lib/admin/client';
import { canModerateComments, type Role } from '@/lib/auth/permissions';
import type { CommentView } from '@/lib/comments/service';
import { formatDate } from '@/lib/format';
import { AuthorAvatar } from '@/components/author-avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Me = { id: string; role: Role } | null;

// Quem está logado (qualquer papel ativo, inclusive leitor). Sem sessão,
// 401 — e é exatamente o caso do visitante comum.
async function fetchMe(): Promise<Me> {
  const response = await fetch('/api/admin/me', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as {
    profile?: { id?: unknown; role?: unknown };
  } | null;
  const profile = data?.profile;
  return profile && typeof profile.id === 'string' && typeof profile.role === 'string'
    ? { id: profile.id, role: profile.role as Role }
    : null;
}

async function fetchList(postSlug: string): Promise<CommentView[]> {
  const response = await fetch(`/api/comments?post=${encodeURIComponent(postSlug)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  const data = (await response.json().catch(() => null)) as { comments?: CommentView[] } | null;
  if (!data || !Array.isArray(data.comments)) throw new Error('Resposta inválida.');
  return data.comments;
}

export function CommentsSection({
  postSlug,
  title,
  initial,
}: {
  postSlug: string;
  title: string;
  initial: CommentView[];
}) {
  const [comments, setComments] = useState(initial);
  // undefined = ainda perguntando ao servidor; null = visitante.
  // Enquanto isso repete o HTML estático (lista + convite), sem hydration mismatch.
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetchMe()
      .then((identity) => alive && setMe(identity))
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, []);

  const reload = async () => {
    try {
      setComments(await fetchList(postSlug));
    } catch {
      // Mantém a lista atual; o erro da ação já apareceu no formulário.
    }
  };

  const moderator = me !== undefined && me !== null && canModerateComments(me.role);

  return (
    <>
      <h2 className="mb-8 text-2xl font-bold">
        {title}
        {comments.length > 0 && (
          <span className="ml-2 text-base font-normal text-muted-foreground tabular-nums">
            {comments.length}
          </span>
        )}
      </h2>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há comentários. Seja a primeira pessoa a comentar.
        </p>
      ) : (
        <ul className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              mine={me !== undefined && me !== null && me.id === comment.author?.id}
              canModerate={moderator}
              onDone={reload}
            />
          ))}
        </ul>
      )}

      {me ? (
        <CommentForm postSlug={postSlug} onDone={reload} />
      ) : (
        <p className="mt-8 rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          <Link href="/admin/cadastro" className="text-foreground underline underline-offset-4">
            Crie uma conta
          </Link>{' '}
          ou{' '}
          <a
            href={`/api/auth/login?returnTo=${encodeURIComponent(`/posts/${postSlug}`)}`}
            className="text-foreground underline underline-offset-4"
          >
            entre
          </a>{' '}
          para comentar.
        </p>
      )}
    </>
  );
}

export function CommentForm({ postSlug, onDone }: { postSlug: string; onDone: () => void }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await adminFetch('/api/comments', {
        method: 'POST',
        body: JSON.stringify({ post: postSlug, body }),
      });
      setBody('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível comentar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8">
      <label htmlFor="novo-comentario" className="mb-2 block text-sm font-medium">
        Deixe um comentário
      </label>
      <Textarea
        id="novo-comentario"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="O que achou do post?"
        className="resize-y"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm" disabled={sending || !body.trim()}>
          Comentar
        </Button>
      </div>
    </form>
  );
}

export function CommentItem({
  comment,
  mine,
  canModerate,
  onDone,
}: {
  comment: CommentView;
  mine: boolean;
  canModerate: boolean;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await adminFetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: draft }),
      });
      setEditing(false);
      onDone();
    } catch {
      setDraft(comment.body);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await adminFetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
      onDone();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const setVisibility = async (status: 'visible' | 'hidden') => {
    if (busy) return;
    setBusy(true);
    try {
      await adminFetch(`/api/comments/${comment.id}/visibility`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const edited = new Date(comment.updatedAt).getTime() !== new Date(comment.createdAt).getTime();

  return (
    <li className="flex gap-3">
      <AuthorAvatar
        author={{ name: comment.author?.name ?? '?', avatarUrl: comment.author?.avatarUrl }}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">
            {comment.author ? comment.author.name : 'Conta removida'}
          </span>
          {comment.author && (
            <span className="text-xs text-muted-foreground">@{comment.author.username}</span>
          )}
          <time
            dateTime={new Date(comment.createdAt).toISOString()}
            className="text-xs text-muted-foreground"
          >
            {formatDate(comment.createdAt)}
          </time>
          {edited && <span className="text-xs text-muted-foreground">· editado</span>}
        </p>

        {editing ? (
          <div className="mt-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={2000}
              aria-label="Editar comentário"
              className="resize-y"
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={save} disabled={busy || !draft.trim()}>
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {comment.body}
          </p>
        )}

        {!editing && (mine || canModerate) && (
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
            {mine && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Editar
              </button>
            )}
            {canModerate && (
              <button
                type="button"
                onClick={() => setVisibility('hidden')}
                disabled={busy}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Ocultar
              </button>
            )}
            {(mine || canModerate) &&
              (confirming ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="font-medium text-destructive hover:underline"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="text-muted-foreground hover:underline"
                  >
                    Voltar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Apagar
                </button>
              ))}
          </div>
        )}
      </div>
    </li>
  );
}
