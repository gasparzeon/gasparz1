'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { adminFetch } from '@/lib/admin/client';
import { formatDate } from '@/lib/format';
import type { PageSummary } from '@/lib/site/pages-schema';
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

export function PagesTable({ pages }: { pages: PageSummary[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<PageSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/pages/${removing.id}?version=${removing.version}`, {
        method: 'DELETE',
      });
      toast.success(`“${removing.title}” foi excluída.`);
      setRemoving(null);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button asChild>
          <Link href="/admin/paginas/nova">
            <Plus /> Nova página
          </Link>
        </Button>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-sm border-2 border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          Nenhuma página ainda.
        </div>
      ) : (
        <ul className="gz-panel divide-y divide-border p-0">
          {pages.map((page) => (
            <li key={page.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{page.title}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded border px-1.5 py-px text-[10px] tracking-wider uppercase',
                        page.status === 'published'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {page.status === 'published' ? 'Publicada' : 'Rascunho'}
                    </span>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    /{page.slug} · atualizada em {formatDate(page.updatedAt)}
                    {page.updatedBy?.name && <> por {page.updatedBy.name}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {page.status === 'published' && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/${page.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink /> Ver
                      <span className="sr-only"> {page.title} no site (abre em nova aba)</span>
                    </a>
                  </Button>
                )}
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/paginas/${page.id}`}>
                    <Pencil /> Editar
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoving(page)}
                  aria-label={`Excluir ${page.title}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{removing?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O endereço /{removing?.slug} passa a mostrar a página 404. Links no menu ou no rodapé
              que apontam para ela precisam ser ajustados em Site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={remove}>
              {busy && <Spinner />} Excluir página
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
