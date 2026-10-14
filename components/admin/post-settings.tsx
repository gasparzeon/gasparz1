'use client';

import { ImagePlus, RotateCcw, Trash2, Undo2, X } from 'lucide-react';

import type { PostStatus } from '@/lib/auth/permissions';
import { SLUG_RE, slugify, todayISO } from '@/lib/cms/schema';
import { SECTIONS, type SectionKey } from '@/lib/sections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { TagInput } from './tag-input';

export type EditorFields = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  // Seção do arquivo; vazio = sem seção.
  section: SectionKey | '';
  coverImage: string;
};

interface PostSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: EditorFields;
  onChange: (patch: Partial<EditorFields>) => void;
  savedSlug: string | null;
  status: PostStatus;
  canDelete: boolean;
  busy: boolean;
  tagSuggestions: string[];
  // Só para editores: quem assina o post.
  authors?: { id: string; name: string; username: string }[];
  authorId: string;
  onAuthorChange: (authorId: string) => void;
  onPickCover: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border/60 px-6 py-5 last:border-0">
      <h3 className="font-sans text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Counter({ value, limit }: { value: number; limit: number }) {
  return (
    <span
      className={cn(
        'tabular-nums',
        value > limit ? 'text-yellow-700 dark:text-yellow-400' : 'text-muted-foreground',
      )}
    >
      {value}/{limit}
    </span>
  );
}

export function PostSettings({
  open,
  onOpenChange,
  fields,
  onChange,
  savedSlug,
  status,
  canDelete,
  busy,
  tagSuggestions,
  authors,
  authorId,
  onAuthorChange,
  onPickCover,
  onUnpublish,
  onDelete,
}: PostSettingsProps) {
  const isPublished = status === 'published';
  const slugValid = SLUG_RE.test(fields.slug);
  const slugChanged = savedSlug !== null && fields.slug !== savedSlug;
  const host = typeof window !== 'undefined' ? window.location.host : 'gasparlabs.com.br';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle className="font-sans text-base tracking-normal">
            Configurações do post
          </SheetTitle>
          <SheetDescription>URL, datas, seção, tags, capa e SEO.</SheetDescription>
        </SheetHeader>

        <Section title="URL">
          <div className="flex items-center rounded-md border border-input focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
            <span className="pl-3 text-sm text-muted-foreground select-none">/posts/</span>
            <input
              value={fields.slug}
              onChange={(event) =>
                onChange({ slug: event.target.value.toLowerCase().replace(/\s+/g, '-') })
              }
              className="h-9 min-w-0 flex-1 bg-transparent pr-2 text-sm outline-none"
              aria-label="Slug"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => onChange({ slug: slugify(fields.title) })}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              title="Gerar a partir do título"
              aria-label="Gerar slug a partir do título"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          {!slugValid && fields.slug && (
            <p className="text-xs text-destructive">Use letras minúsculas, números e hífens.</p>
          )}
          {slugChanged && isPublished && slugValid && (
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              Mudar a URL de um post publicado quebra links já compartilhados.
            </p>
          )}
        </Section>

        <Section title="Datas">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="published-at" className="text-xs font-normal text-muted-foreground">
                Publicação
              </Label>
              <Input
                id="published-at"
                type="date"
                value={fields.publishedAt}
                onChange={(event) => onChange({ publishedAt: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="updated-at" className="text-xs font-normal text-muted-foreground">
                Atualização
              </Label>
              <div className="relative">
                <Input
                  id="updated-at"
                  type="date"
                  value={fields.updatedAt}
                  onChange={(event) => onChange({ updatedAt: event.target.value })}
                  className={fields.updatedAt ? 'pr-8' : undefined}
                />
                {fields.updatedAt && (
                  <button
                    type="button"
                    onClick={() => onChange({ updatedAt: '' })}
                    className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Limpar data de atualização"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          {!fields.updatedAt && (
            <button
              type="button"
              onClick={() => onChange({ updatedAt: todayISO() })}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Marcar como atualizado hoje
            </button>
          )}
        </Section>

        {authors && authors.length > 0 && (
          <Section title="Autor">
            <select
              value={authorId}
              onChange={(event) => onAuthorChange(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50 dark:bg-input/30"
              aria-label="Autor do post"
            >
              {authors.map((author) => (
                <option key={author.id} value={author.id} className="bg-popover">
                  {author.name} (@{author.username})
                </option>
              ))}
            </select>
          </Section>
        )}

        <Section title="Seção">
          <select
            value={fields.section ?? ''}
            onChange={(event) => onChange({ section: event.target.value as SectionKey | '' })}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50 dark:bg-input/30"
            aria-label="Seção do post"
          >
            <option value="" className="bg-popover">
              Sem seção
            </option>
            {SECTIONS.map((section) => (
              <option key={section.key} value={section.key} className="bg-popover">
                {section.many}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Define a forma e o filtro do post no site (Investigações, Pesquisas…).
          </p>
        </Section>

        <Section title="Tags">
          <TagInput
            value={fields.tags}
            onChange={(tags) => onChange({ tags })}
            suggestions={tagSuggestions}
          />
        </Section>

        <Section title="Imagem de capa">
          {fields.coverImage ? (
            <div className="group relative overflow-hidden rounded-lg border border-border">
              <img src={fields.coverImage} alt="" className="aspect-[2/1] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/80 p-2">
                <Button size="sm" variant="secondary" className="h-7" onClick={onPickCover}>
                  Trocar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => onChange({ coverImage: '' })}
                >
                  Remover
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPickCover}
              className="flex aspect-[2/1] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
            >
              <ImagePlus className="h-5 w-5" />
              Adicionar capa
            </button>
          )}
        </Section>

        <Section title="Prévia em buscadores">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="truncate text-xs text-muted-foreground">
              {host} › posts › {fields.slug || 'slug'}
            </p>
            <p className="mt-1 line-clamp-1 text-[15px] font-medium text-sky-700 dark:text-sky-300">
              {fields.title || 'Título do post'} | Gaspar Labs
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {fields.excerpt ||
                'Escreva um resumo abaixo do título para controlar esta descrição.'}
            </p>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Título <Counter value={fields.title.length} limit={60} />
            </span>
            <span className="text-muted-foreground">
              Resumo <Counter value={fields.excerpt.length} limit={160} />
            </span>
          </div>
        </Section>

        {savedSlug !== null && (
          <Section title="Zona de perigo">
            <div className="flex flex-col gap-2">
              {status !== 'draft' && (
                <Button
                  variant="outline"
                  onClick={onUnpublish}
                  disabled={busy}
                  className="justify-start"
                >
                  <Undo2 />
                  {isPublished ? 'Despublicar (voltar para rascunho)' : 'Tirar da revisão'}
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  onClick={onDelete}
                  disabled={busy}
                  className="justify-start border-red-500/30 text-destructive hover:bg-red-500/10 hover:text-destructive"
                >
                  <Trash2 />
                  Excluir post
                </Button>
              )}
            </div>
          </Section>
        )}
      </SheetContent>
    </Sheet>
  );
}
