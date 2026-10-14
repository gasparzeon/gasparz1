'use client';

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Columns2, Eye, History, PenLine, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { ApiError, adminFetch } from '@/lib/admin/client';
import { imageMarkdown, videoMarkdown, youtubeMarkdown } from '@/lib/admin/markdown';
import {
  canDeletePost,
  canEditAllPosts,
  canPublish,
  type PostStatus,
  type Role,
} from '@/lib/auth/permissions';
import type { MediaMode } from '@/lib/cms/media-types';
import { SLUG_RE, slugify, todayISO, type PostDocument } from '@/lib/cms/schema';
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

import { DeletePostDialog, type DeleteTarget } from './delete-post-dialog';
import { MarkdownEditor, type MarkdownEditorHandle } from './markdown-editor';
import { MediaDialog, type MediaDialogKind, type MediaInsert } from './media-dialog';
import { StatusBadge } from './posts-table';
import { PostPreview, readingMinutes } from './post-preview';
import { LogoMark } from '@/components/site/section-sig';

import { PostSettings, type EditorFields } from './post-settings';
import { RelativeMediaNotice } from './relative-media-notice';

type View = 'write' | 'split' | 'preview';

// save: mantém o status; os demais mudam o status ao salvar.
type SaveMode = 'save' | 'publish' | 'submit' | 'unpublish';

type Saved = {
  id: string | null;
  slug: string | null;
  version: number | null;
  status: PostStatus;
  snapshot: string;
};

type Backup = { fields: EditorFields; savedAt: number };

type Viewer = { id: string; name: string; role: Role; avatarUrl: string };
type AuthorOption = { id: string; name: string; username: string };

const VIEW_KEY = 'gaspar-admin:view';
const backupKey = (id: string | null) => `gaspar-admin:backup:${id ?? 'new'}`;

function emptyFields(): EditorFields {
  return {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    publishedAt: todayISO(),
    updatedAt: '',
    tags: [],
    section: '',
    coverImage: '',
  };
}

function fieldsOf(post: PostDocument): EditorFields {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    publishedAt: post.publishedAt || todayISO(),
    updatedAt: post.updatedAt,
    tags: post.tags,
    section: post.section ?? '',
    coverImage: post.coverImage,
  };
}

const snapshot = (fields: EditorFields, authorId: string) => JSON.stringify({ fields, authorId });

function storageRead<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function storageWrite(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Textarea que cresce com o conteúdo (título e resumo).
function AutoTextarea({
  className,
  onEnter,
  ref: externalRef,
  ...props
}: Omit<React.ComponentProps<'textarea'>, 'ref'> & {
  onEnter?: () => void;
  ref?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || CSS.supports?.('field-sizing', 'content')) return;
    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  }, [props.value]);

  return (
    <textarea
      ref={(element) => {
        ref.current = element;
        if (externalRef) externalRef.current = element;
      }}
      rows={1}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && onEnter) {
          event.preventDefault();
          onEnter();
        }
      }}
      className={cn(
        'block [field-sizing:content] w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

const VIEWS: { id: View; label: string; icon: typeof Eye; className?: string }[] = [
  { id: 'write', label: 'Escrever', icon: PenLine },
  { id: 'split', label: 'Dividir', icon: Columns2, className: 'hidden lg:flex' },
  { id: 'preview', label: 'Visualizar', icon: Eye },
];

function saveTitle(mode: SaveMode) {
  if (mode === 'publish') return 'Post publicado';
  if (mode === 'submit') return 'Enviado para revisão';
  if (mode === 'unpublish') return 'Voltou para rascunho';
  return 'Alterações salvas';
}

interface PostEditorProps {
  initial: PostDocument | null;
  viewer: Viewer;
  authors: AuthorOption[];
  mediaMode: MediaMode;
  tagSuggestions: string[];
}

export function PostEditor({
  initial,
  viewer,
  authors,
  mediaMode,
  tagSuggestions,
}: PostEditorProps) {
  const router = useRouter();
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);

  const initialFields = initial ? fieldsOf(initial) : emptyFields();
  const initialAuthor = initial?.author.id ?? viewer.id;

  const [fields, setFields] = useState<EditorFields>(initialFields);
  const [authorId, setAuthorId] = useState(initialAuthor);
  const [saved, setSaved] = useState<Saved>(() => ({
    id: initial?.id ?? null,
    slug: initial?.slug ?? null,
    version: initial?.version ?? null,
    status: initial?.status ?? 'draft',
    snapshot: snapshot(initialFields, initialAuthor),
  }));
  const [slugTouched, setSlugTouched] = useState(initial !== null);
  const [view, setView] = useState<View>('write');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mediaKind, setMediaKind] = useState<MediaDialogKind | null>(null);
  const [busy, setBusy] = useState<SaveMode | null>(null);
  const [conflict, setConflict] = useState<SaveMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [recovery, setRecovery] = useState<Backup | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = useMemo(
    () => snapshot(fields, authorId) !== saved.snapshot,
    [fields, authorId, saved.snapshot],
  );
  const isNew = saved.id === null;
  const publisher = canPublish(viewer.role);
  const editorRole = canEditAllPosts(viewer.role);
  const author =
    authors.find((option) => option.id === authorId) ??
    (initial && initial.author.id === authorId ? initial.author : null);
  const authorDisplay =
    authorId === viewer.id
      ? { name: viewer.name, avatarUrl: viewer.avatarUrl }
      : { name: author?.name ?? 'Autor', avatarUrl: initial?.author.avatarUrl ?? '' };

  const update = useCallback((patch: Partial<EditorFields>) => {
    setFields((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    const storedView = storageRead<View>(VIEW_KEY);
    if (storedView) setView(storedView);

    const backup = storageRead<Backup>(backupKey(initial?.id ?? null));
    if (backup && JSON.stringify(backup.fields) !== JSON.stringify(initialFields)) {
      setRecovery(backup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      storageWrite(backupKey(saved.id), { fields, savedAt: Date.now() } satisfies Backup);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [fields, dirty, saved.id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const changeView = (next: View) => {
    setView(next);
    storageWrite(VIEW_KEY, next);
  };

  const nextStatus = (mode: SaveMode): PostStatus => {
    if (mode === 'publish') return 'published';
    if (mode === 'submit') return 'review';
    if (mode === 'unpublish') return 'draft';
    return saved.status;
  };

  const save = useCallback(
    async (mode: SaveMode, options: { overwrite?: boolean } = {}) => {
      if (busy) return;

      const title = fields.title.trim();
      if (!title) {
        toast.error('Dê um título ao post antes de salvar.');
        return;
      }

      const slug = fields.slug || slugify(title);
      if (!SLUG_RE.test(slug)) {
        toast.error('A URL do post é inválida.', {
          description: 'Ajuste o slug nas configurações.',
        });
        setSettingsOpen(true);
        return;
      }

      const sent: EditorFields = { ...fields, title, slug };
      setBusy(mode);

      try {
        let expectedVersion = saved.version;
        if (options.overwrite && saved.id) {
          const current = await adminFetch<{ post: PostDocument }>(`/api/admin/posts/${saved.id}`);
          expectedVersion = current.post.version;
        }

        const body = JSON.stringify({
          post: { ...sent, authorId },
          status: nextStatus(mode),
          expectedVersion: saved.id ? expectedVersion : null,
        });

        const { post } = saved.id
          ? await adminFetch<{ post: PostDocument }>(`/api/admin/posts/${saved.id}`, {
              method: 'PUT',
              body,
            })
          : await adminFetch<{ post: PostDocument }>('/api/admin/posts', { method: 'POST', body });

        const next = fieldsOf(post);
        // Se o autor digitou durante o salvamento, mantém o que ele digitou.
        setFields((current) =>
          JSON.stringify(current) === JSON.stringify(fields) ? next : current,
        );
        setSaved({
          id: post.id,
          slug: post.slug,
          version: post.version,
          status: post.status,
          snapshot: snapshot(next, post.author.id),
        });
        setAuthorId(post.author.id);
        setSlugTouched(true);
        setSavedAt(new Date());
        setRecovery(null);
        storageWrite(backupKey(saved.id), null);
        storageWrite(backupKey(post.id), null);

        if (!saved.id) window.history.replaceState(null, '', `/admin/posts/${post.id}`);

        toast.success(saveTitle(mode), {
          description:
            post.status === 'published'
              ? 'Já está no ar (o site pode levar alguns segundos para atualizar).'
              : post.status === 'review'
                ? 'Um editor vai revisar e publicar.'
                : undefined,
          action:
            post.status === 'published'
              ? { label: 'Ver post', onClick: () => window.open(`/posts/${post.slug}`, '_blank') }
              : undefined,
        });
      } catch (error) {
        if (!(error instanceof ApiError)) {
          toast.error('Erro inesperado ao salvar.');
        } else if (error.code === 'conflict') {
          setConflict(mode);
        } else if (error.code === 'exists') {
          toast.error(error.message, { description: 'Escolha outra URL nas configurações.' });
          setSettingsOpen(true);
        } else if (error.code === 'not_found') {
          setSaved((current) => ({ ...current, id: null, version: null }));
          toast.error('Este post foi removido em outro lugar.', {
            description: 'Salve novamente para recriá-lo.',
          });
        } else {
          toast.error(error.message);
        }
      } finally {
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, fields, saved, authorId],
  );

  const onSaveShortcut = useEffectEvent(() => save('save'));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void onSaveShortcut();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const reloadFromServer = async () => {
    if (!saved.id) return;
    try {
      const { post } = await adminFetch<{ post: PostDocument }>(`/api/admin/posts/${saved.id}`);
      const next = fieldsOf(post);
      setFields(next);
      setAuthorId(post.author.id);
      setSaved({
        id: post.id,
        slug: post.slug,
        version: post.version,
        status: post.status,
        snapshot: snapshot(next, post.author.id),
      });
      toast.success('Versão do servidor carregada.');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const onInsertMedia = (media: MediaInsert) => {
    const target = mediaKind;
    setMediaKind(null);

    if (target === 'cover') {
      if (media.kind === 'image') update({ coverImage: media.url });
      return;
    }

    const snippet =
      media.kind === 'image'
        ? imageMarkdown(media.url, media.alt, media.caption)
        : media.kind === 'video'
          ? videoMarkdown(media.url, media.caption)
          : youtubeMarkdown(media.id, media.start, media.caption);

    window.requestAnimationFrame(() => editorRef.current?.insert(snippet));
  };

  const leave = (event: React.MouseEvent) => {
    if (dirty && !window.confirm('Há alterações não salvas. Sair mesmo assim?')) {
      event.preventDefault();
    }
  };

  const minutes = readingMinutes(fields.content);
  const words = fields.content.split(/\s+/).filter(Boolean).length;
  const canDelete =
    !isNew &&
    canDeletePost(viewer, { authorId: saved.id ? authorId : viewer.id, status: saved.status });

  let statusText: React.ReactNode;
  if (busy) {
    statusText = (
      <span className="flex items-center gap-1.5">
        <Spinner className="h-3 w-3" /> Salvando…
      </span>
    );
  } else if (dirty) {
    statusText = (
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" /> Não salvo
      </span>
    );
  } else if (isNew) {
    statusText = 'Novo post';
  } else {
    statusText = savedAt
      ? `Salvo às ${savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : 'Salvo';
  }

  // Botões conforme papel e status (o servidor valida de novo).
  let actions: React.ReactNode;
  if (saved.status === 'published') {
    actions = (
      <Button size="sm" onClick={() => save('save')} disabled={busy !== null || !dirty}>
        {busy === 'save' && <Spinner />}
        Atualizar
      </Button>
    );
  } else if (publisher) {
    actions = (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => save('save')}
          disabled={busy !== null}
          className="hidden sm:inline-flex"
        >
          {busy === 'save' && <Spinner />}
          Salvar
        </Button>
        <Button size="sm" onClick={() => save('publish')} disabled={busy !== null}>
          {busy === 'publish' && <Spinner />}
          {saved.status === 'review' && editorRole ? 'Aprovar e publicar' : 'Publicar'}
        </Button>
      </>
    );
  } else {
    actions = (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => save('save')}
          disabled={busy !== null}
          className="hidden sm:inline-flex"
        >
          {busy === 'save' && <Spinner />}
          Salvar
        </Button>
        {saved.status !== 'review' && (
          <Button size="sm" onClick={() => save('submit')} disabled={busy !== null}>
            {busy === 'submit' && <Spinner />}
            Enviar para revisão
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="gz-root flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:gap-3 sm:px-4">
        <Link href="/admin" onClick={leave} className="gz-btn gz-btn--ghost gz-btn--sm">
          <ArrowLeft className="gz-ico" aria-hidden="true" />
          <LogoMark />
          <span className="gz-sr">Voltar aos </span>
          <span className="max-sm:sr-only">Posts</span>
        </Link>

        <span className="hidden h-5 w-px bg-border sm:block" />

        <StatusBadge status={saved.status} />
        <span className="hidden text-xs text-muted-foreground md:block">{statusText}</span>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="gz-seg hidden sm:inline-flex" role="group" aria-label="Modo do editor">
            {VIEWS.map(({ id, label, icon: Icon, className }) => (
              <button
                key={id}
                type="button"
                onClick={() => changeView(id)}
                className={className}
                aria-pressed={view === id}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            onClick={() => changeView(view === 'preview' ? 'write' : 'preview')}
            aria-label={view === 'preview' ? 'Voltar a escrever' : 'Visualizar'}
          >
            {view === 'preview' ? <PenLine /> : <Eye />}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSettingsOpen(true)}
            aria-label="Configurações do post"
          >
            <Settings2 />
          </Button>

          {actions}
        </div>
      </header>

      {saved.status === 'review' && !publisher && (
        <div className="border-b border-sky-500/20 bg-sky-500/5 px-4 py-2 text-sm text-foreground">
          Este post está em revisão. Você ainda pode editar até um editor publicar.
        </div>
      )}

      <RelativeMediaNotice
        content={fields.content}
        onFix={(content, changed, repo, ref) => {
          // Pelo editor, para o Ctrl+Z desfazer; no modo Visualizar, direto no estado.
          if (!editorRef.current?.replaceAll(content)) update({ content });
          const branch = ref.name === 'HEAD' ? '' : ` (branch ${ref.name})`;
          toast.success(
            `${changed} ${changed === 1 ? 'caminho agora aponta' : 'caminhos agora apontam'} para github.com/${repo.owner}/${repo.repo}${branch}.`,
            {
              description:
                ref.pinned !== ref.name
                  ? `As imagens ficaram fixadas no commit ${ref.pinned.slice(0, 7)} e não quebram se o repositório mudar.`
                  : 'Para não depender do repositório, você também pode enviar as imagens para a biblioteca.',
            },
          );
        }}
      />

      {recovery && (
        <div className="flex flex-wrap items-center gap-3 border-b border-sky-500/20 bg-sky-500/5 px-4 py-2 text-sm">
          <History className="h-4 w-4 text-sky-700 dark:text-sky-300" />
          <span className="text-muted-foreground">
            Há alterações não salvas de{' '}
            {new Date(recovery.savedAt).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
            .
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-7"
              onClick={() => {
                setFields(recovery.fields);
                setRecovery(null);
              }}
            >
              Restaurar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                storageWrite(backupKey(saved.id), null);
                setRecovery(null);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      )}

      <main
        id="painel"
        tabIndex={-1}
        className={cn('grid min-h-0 flex-1 outline-none', view === 'split' && 'lg:grid-cols-2')}
      >
        {view !== 'preview' && (
          <div data-editor-scroll className="min-h-0 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-5 pt-10 pb-40 sm:px-8">
              <AutoTextarea
                value={fields.title}
                onChange={(event) => {
                  const title = event.target.value.replace(/\n/g, ' ');
                  setFields((current) => ({
                    ...current,
                    title,
                    slug: slugTouched ? current.slug : slugify(title),
                  }));
                }}
                onEnter={() => excerptRef.current?.focus()}
                placeholder="Título do post"
                aria-label="Título"
                autoFocus={isNew}
                className="font-serif text-4xl leading-tight font-bold tracking-tight md:text-5xl"
              />
              <AutoTextarea
                ref={excerptRef}
                value={fields.excerpt}
                onChange={(event) => update({ excerpt: event.target.value.replace(/\n/g, ' ') })}
                onEnter={() => editorRef.current?.focus()}
                placeholder="Um resumo curto: aparece na listagem e no Google."
                aria-label="Resumo"
                className="mt-4 text-lg leading-relaxed text-muted-foreground"
              />

              <MarkdownEditor
                ref={editorRef}
                value={fields.content}
                onChange={(content) => update({ content })}
                mediaMode={mediaMode}
                onRequestMedia={setMediaKind}
                className="mt-8"
              />
            </div>
          </div>
        )}

        {view !== 'write' && (
          <div
            className={cn(
              'min-h-0 overflow-y-auto',
              view === 'split' && 'hidden border-l border-border/60 bg-card/30 lg:block',
            )}
          >
            <PostPreview
              title={fields.title}
              content={fields.content}
              tags={fields.tags}
              publishedAt={fields.publishedAt}
              updatedAt={fields.updatedAt}
              coverImage={fields.coverImage}
              author={authorDisplay}
            />
          </div>
        )}
      </main>

      <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-border/60 px-4 text-xs text-muted-foreground">
        <span>{words.toLocaleString('pt-BR')} palavras</span>
        <span>·</span>
        <span>{minutes} min de leitura</span>
        <span className="ml-auto hidden truncate sm:block">
          Markdown · digite “/” para inserir blocos
        </span>
      </footer>

      <PostSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        fields={fields}
        onChange={(patch) => {
          if (patch.slug !== undefined) setSlugTouched(true);
          update(patch);
        }}
        savedSlug={saved.slug}
        status={saved.status}
        canDelete={canDelete}
        busy={busy !== null}
        tagSuggestions={tagSuggestions}
        authors={editorRole ? authors : undefined}
        authorId={authorId}
        onAuthorChange={setAuthorId}
        onPickCover={() => setMediaKind('cover')}
        onUnpublish={() => {
          setSettingsOpen(false);
          void save('unpublish');
        }}
        onDelete={() => {
          if (!saved.id || !saved.version) return;
          setSettingsOpen(false);
          setDeleteTarget({ id: saved.id, title: fields.title || 'Post', version: saved.version });
        }}
      />

      <MediaDialog
        kind={mediaKind}
        mediaMode={mediaMode}
        onClose={() => setMediaKind(null)}
        onInsert={onInsertMedia}
      />

      <DeletePostDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => {
          storageWrite(backupKey(id), null);
          setSaved((current) => ({ ...current, snapshot: snapshot(fields, authorId) }));
          router.push('/admin');
          router.refresh();
        }}
      />

      <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este post mudou em outro lugar</AlertDialogTitle>
            <AlertDialogDescription>
              Alguém salvou uma versão mais nova (outra aba, outro dispositivo ou outro autor) desde
              que você abriu o editor. Suas alterações continuam guardadas neste navegador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConflict(null);
                void reloadFromServer();
              }}
            >
              Carregar versão do servidor
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                const mode = conflict ?? 'save';
                setConflict(null);
                void save(mode, { overwrite: true });
              }}
            >
              Sobrescrever com a minha
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
