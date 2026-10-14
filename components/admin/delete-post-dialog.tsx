'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { adminFetch } from '@/lib/admin/client';
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

export type DeleteTarget = { id: string; title: string; version: number };

interface DeletePostDialogProps {
  target: DeleteTarget | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function DeletePostDialog({ target, onClose, onDeleted }: DeletePostDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await adminFetch(`/api/admin/posts/${target.id}?version=${target.version}`, {
        method: 'DELETE',
      });
      toast.success(`“${target.title}” foi excluído.`);
      onDeleted(target.id);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && !deleting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{target?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            O post sai do ar e é apagado do banco de dados. Essa ação não pode ser desfeita; se
            quiser só tirá-lo do site, use “Despublicar”.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting && <Spinner />}
            Excluir post
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
