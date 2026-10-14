'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Eye, PenLine, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { ApiError, adminFetch } from '@/lib/admin/client';
import { imageMarkdown, videoMarkdown, youtubeMarkdown } from '@/lib/admin/markdown';
import type { MediaMode } from '@/lib/cms/media-types';
import { slugify } from '@/lib/cms/schema';
import {
  emptyBlock,
  pageInputSchema,
  type PageBlock,
  type PageBlockType,
  type PageDocument,
  type PageInput,
  type PageStatus,
} from '@/lib/site/pages-schema';
import type { SiteSettings } from '@/lib/site/schema';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import type { MarkdownEditorHandle, MediaRequest } from '../markdown-editor';
import { MediaDialog, type MediaInsert } from '../media-dialog';
import { FieldGroup, TextField } from '../site/fields';
import { BLOCK_LABELS, BlockEditor } from './block-editor';
import { PagePreview } from './page-preview';

type SaveMode = 'save' | 'publish' | 'unpublish';

type Saved = { id: string | null; version: number | null; status: PageStatus; snapshot: string };

const BLOCK_TYPES = Object.keys(BLOCK_LABELS) as PageBlockType[];

const fieldsOf = (page: PageDocument | null): PageInput =>
  page
    ? {
        slug: page.slug,
        title: page.title,
        description: page.description,
        showBackLink: page.showBackLink,
        blocks: page.blocks,
      }
    : {
        slug: '',
        title: '',
        description: '',
        showBackLink: false,
        blocks: [emptyBlock('markdown')],
      };

function nextStatus(mode: SaveMode, current: PageStatus): PageStatus {
  if (mode === 'publish') return 'published';
  if (mode === 'unpublish') return 'draft';
  return current;
}

type PageEditorProps = {
  initial: PageDocument | null;
  social: SiteSettings['social'];
  mediaMode: MediaMode;
};

export function PageEditor({ initial, social, mediaMode }: PageEditorProps) {
  const router = useRouter();
  const [fields, setFields] = useState<PageInput>(() => fieldsOf(initial));
  const [saved, setSaved] = useState<Saved>(() => ({
    id: initial?.id ?? null,
    version: initial?.version ?? null,
    status: initial?.status ?? 'draft',
    snapshot: JSON.stringify(fieldsOf(initial)),
  }));
  const [slugTouched, setSlugTouched] = useState(initial !== null);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState<SaveMode | null>(null);
  const [media, setMedia] = useState<{ blockId: string; kind: MediaRequest } | null>(null);
  const editors = useRef(new Map<string, MarkdownEditorHandle>());

  const dirty = useMemo(() => JSON.stringify(fields) !== saved.snapshot, [fields, saved.snapshot]);
  const isNew = saved.id === null;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch: Partial<PageInput>) => setFields((current) => ({ ...current, ...patch }));
  const setBlocks = (blocks: PageBlock[]) => update({ blocks });

  const changeTitle = (title: string) =>
    setFields((current) => ({
      ...current,
      title,
      slug: slugTouched ? current.slug : slugify(title).slice(0, 60),
    }));

  const moveBlock = (index: number, direction: -1 | 1) => {
    const blocks = [...fields.blocks];
    const [block] = blocks.splice(index, 1);
    blocks.splice(index + direction, 0, block);
    setBlocks(blocks);
  };

  const save = async (mode: SaveMode) => {
    if (busy) return;
    const parsed = pageInputSchema.safeParse(fields);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Confira os campos da página.');
      return;
    }

    setBusy(mode);
    try {
      const body = JSON.stringify({
        page: parsed.data,
        status: nextStatus(mode, saved.status),
        expectedVersion: saved.version,
      });
      const { page } = saved.id
        ? await adminFetch<{ page: PageDocument }>(`/api/admin/pages/${saved.id}`, {
            method: 'PUT',
            body,
          })
        : await adminFetch<{ page: PageDocument }>('/api/admin/pages', { method: 'POST', body });

      const next = fieldsOf(page);
      setFields(next);
      setSaved({
        id: page.id,
        version: page.version,
        status: page.status,
        snapshot: JSON.stringify(next),
      });
      setSlugTouched(true);
      if (!saved.id) window.history.replaceState(null, '', `/admin/paginas/${page.id}`);

      toast.success(
        mode === 'publish'
          ? 'Página publicada'
          : mode === 'unpublish'
            ? 'Página voltou para rascunho'
            : 'Página salva',
        page.status === 'published'
          ? {
              action: {
                label: 'Ver página',
                onClick: () => window.open(`/${page.slug}`, '_blank'),
              },
            }
          : undefined,
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'conflict') {
        toast.error(error.message, {
          description: 'Recarregue para ver a versão mais nova.',
          action: { label: 'Recarregar', onClick: () => router.refresh() },
        });
      } else {
        toast.error((error as Error).message);
      }
    } finally {
      setBusy(null);
    }
  };

  const insertMedia = (item: MediaInsert) => {
    const target = media;
    setMedia(null);
    if (!target) return;
    const snippet =
      item.kind === 'image'
        ? imageMarkdown(item.url, item.alt, item.caption)
        : item.kind === 'video'
          ? videoMarkdown(item.url, item.caption)
          : youtubeMarkdown(item.id, item.start, item.caption);
    window.requestAnimationFrame(() => editors.current.get(target.blockId)?.insert(snippet));
  };

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/paginas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Páginas
        </Link>
        <span
          className={cn(
            'rounded border px-1.5 py-px text-[10px] tracking-wider uppercase',
            saved.status === 'published'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-border text-muted-foreground',
          )}
        >
          {saved.status === 'published' ? 'Publicada' : 'Rascunho'}
        </span>
        <span className="text-xs text-muted-foreground">
          {dirty ? 'Não salvo' : isNew ? 'Nova página' : 'Salvo'}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={view === 'preview'}
            onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}
          >
            {view === 'edit' ? <Eye /> : <PenLine />}
            {view === 'edit' ? 'Visualizar' : 'Editar'}
          </Button>
          {saved.status === 'published' && saved.id && (
            <Button asChild variant="ghost" size="sm">
              <a href={`/${fields.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink /> Ver no site
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </Button>
          )}
          {saved.status === 'published' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => save('unpublish')}
              >
                Despublicar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy !== null || !dirty}
                onClick={() => save('save')}
              >
                {busy === 'save' && <Spinner />} Atualizar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => save('save')}
              >
                {busy === 'save' && <Spinner />} {isNew ? 'Salvar rascunho' : 'Salvar'}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy !== null}
                onClick={() => save('publish')}
              >
                {busy === 'publish' && <Spinner />} Publicar
              </Button>
            </>
          )}
        </div>
      </div>

      {view === 'preview' ? (
        <PagePreview page={fields} social={social} />
      ) : (
        <div className="space-y-6">
          <FieldGroup title="Página">
            <TextField
              label="Título"
              value={fields.title}
              maxLength={120}
              hint="Aparece na aba do navegador e, sem bloco de abertura, no topo da página."
              onChange={changeTitle}
            />
            <TextField
              label="Endereço"
              value={fields.slug}
              maxLength={60}
              hint={`Fica em /${fields.slug || 'endereco'}. Mudar o endereço quebra links já compartilhados.`}
              onChange={(slug) => {
                setSlugTouched(true);
                update({ slug: slug.toLowerCase().replace(/\s+/g, '-') });
              }}
            />
            <TextField
              label="Descrição (Google e prévias de links)"
              value={fields.description}
              maxLength={300}
              multiline
              rows={2}
              onChange={(description) => update({ description })}
            />
          </FieldGroup>

          {fields.blocks.map((block, index) => (
            <BlockEditor
              key={block.id}
              block={block}
              index={index}
              total={fields.blocks.length}
              mediaMode={mediaMode}
              editorRef={(handle) => {
                if (handle) editors.current.set(block.id, handle);
                else editors.current.delete(block.id);
              }}
              onRequestMedia={(kind) => setMedia({ blockId: block.id, kind })}
              onChange={(next) =>
                setBlocks(
                  fields.blocks.map((current) => (current.id === block.id ? next : current)),
                )
              }
              onMove={(direction) => moveBlock(index, direction)}
              onRemove={() => setBlocks(fields.blocks.filter((current) => current.id !== block.id))}
            />
          ))}

          <section className="rounded-sm border-2 border-dashed border-border p-4">
            <p className="mb-3 text-sm font-medium">Adicionar bloco</p>
            <div className="flex flex-wrap gap-2">
              {BLOCK_TYPES.map((type) => {
                const info = new Map(Object.entries(BLOCK_LABELS)).get(type);
                return (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    size="sm"
                    title={info?.description}
                    disabled={fields.blocks.length >= 40}
                    onClick={() => setBlocks([...fields.blocks, emptyBlock(type)])}
                  >
                    <Plus /> {info?.label}
                  </Button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <MediaDialog
        kind={media?.kind ?? null}
        mediaMode={mediaMode}
        onClose={() => setMedia(null)}
        onInsert={insertMedia}
      />
    </div>
  );
}
