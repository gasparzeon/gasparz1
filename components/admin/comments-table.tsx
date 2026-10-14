'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { adminFetch, ApiError } from '@/lib/admin/client';
import type { ManagedComment } from '@/lib/comments/service';
import { formatDate } from '@/lib/format';
import { AuthorAvatar } from '@/components/author-avatar';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'visible' | 'hidden';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'visible', label: 'Visíveis' },
  { id: 'hidden', label: 'Ocultos' },
];

export function CommentsTable({ comments }: { comments: ManagedComment[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ManagedComment | null>(null);

  const shown = comments.filter((comment) => filter === 'all' || comment.status === filter);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível concluir.');
    } finally {
      setBusy(null);
    }
  };

  const setVisibility = (comment: ManagedComment, status: 'visible' | 'hidden') =>
    run(
      `${status}-${comment.id}`,
      () =>
        adminFetch(`/api/comments/${comment.id}/visibility`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        }),
      status === 'hidden' ? 'Comentário ocultado.' : 'Comentário visível de novo.',
    );

  return (
    <>
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-border p-1 sm:w-fit">
        {FILTERS.map((item) => {
          const total =
            item.id === 'all'
              ? comments.length
              : comments.filter((comment) => comment.status === item.id).length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                'flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors',
                filter === item.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-sm border-2 border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          Nenhum comentário aqui.
        </div>
      ) : (
        <ul className="gz-panel divide-y divide-border p-0">
          {shown.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-3 px-5 py-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <AuthorAvatar
                  author={{
                    name: comment.author?.name ?? '?',
                    avatarUrl: comment.author?.avatarUrl,
                  }}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">
                      {comment.author ? comment.author.name : 'Conta removida'}
                    </span>
                    {comment.status === 'hidden' ? (
                      <span className="rounded-sm border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 font-mono text-xs text-yellow-700 dark:text-yellow-300">
                        Oculto
                      </span>
                    ) : (
                      <span className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-400">
                        Visível
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Link
                      href={`/posts/${comment.postSlug}`}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {comment.postTitle}
                    </Link>
                    {' · '}
                    {formatDate(comment.createdAt)}
                    {comment.moderatedAt && (
                      <>
                        {' · moderado'}
                        {comment.moderatedBy && ` por @${comment.moderatedBy}`}
                        {` em ${formatDate(comment.moderatedAt)}`}
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {comment.body}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-12">
                {comment.status === 'visible' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => setVisibility(comment, 'hidden')}
                  >
                    {busy === `hidden-${comment.id}` ? <Spinner /> : <EyeOff />}
                    Ocultar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => setVisibility(comment, 'visible')}
                  >
                    {busy === `visible-${comment.id}` ? <Spinner /> : <Eye />}
                    Exibir
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => setRemoving(comment)}
                  aria-label={`Apagar comentário de ${comment.author?.name ?? 'conta removida'}`}
                >
                  <Trash2 />
                  Apagar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              O texto sai do ar de vez. Para tirar do site sem apagar, use Ocultar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => {
                if (!removing) return;
                const target = removing;
                void run(
                  `remove-${target.id}`,
                  async () => {
                    await adminFetch(`/api/comments/${target.id}`, { method: 'DELETE' });
                    setRemoving(null);
                  },
                  'Comentário apagado.',
                );
              }}
            >
              {busy?.startsWith('remove-') && <Spinner />}
              Apagar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
