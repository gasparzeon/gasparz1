'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { FileText, Search, Tag, X } from 'lucide-react';

import { useSearchStore } from '@/lib/search-store';
import type { Post } from '@/lib/content';
import { getSection } from '@/lib/sections';
import { SectionSig } from '@/components/site/section-sig';

interface SearchDialogProps {
  posts: Post[];
  tags: string[];
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const itemClass =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm aria-selected:bg-[var(--gz-lime)] aria-selected:text-[var(--gz-lime-ink)]';

// Busca rápida (Ctrl/Cmd + K). Diálogo de verdade (Radix): prende o foco,
// fecha com Esc e devolve o foco a quem abriu. Busca sem diferenciar acentos.
// O nome do campo vem do `label` do cmdk (aria-labelledby), não de aria-label.
export function SearchDialog({ posts, tags }: SearchDialogProps) {
  const router = useRouter();
  const { open, setOpen } = useSearchStore();
  const [search, setSearch] = React.useState('');

  const needle = fold(search.trim());
  const filteredPosts = posts.filter(
    (post) => fold(post.title).includes(needle) || fold(post.excerpt).includes(needle),
  );
  const filteredTags = tags.filter((tag) => fold(tag).includes(needle));

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch('');
  };

  const handleSelect = (href: string) => {
    changeOpen(false);
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-slot="sheet-overlay"
          className="fixed inset-0 z-[95] bg-black/60 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          data-slot="sheet-content"
          aria-describedby={undefined}
          className="gz-root fixed top-[10%] left-1/2 z-[96] w-[min(40rem,calc(100%-2rem))] -translate-x-1/2"
        >
          <Dialog.Title className="gz-sr">Buscar no arquivo</Dialog.Title>
          <Command
            className="gz-panel"
            style={{ padding: 0 }}
            shouldFilter={false}
            label="Buscar posts e etiquetas"
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="gz-ico shrink-0 text-muted-foreground" aria-hidden="true" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Buscar posts e etiquetas…"
                className="flex h-14 w-full bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="gz-btn gz-btn--ghost gz-btn--icon gz-btn--sm"
                  aria-label="Fechar busca"
                >
                  <X className="gz-ico" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>

            <Command.List className="max-h-[60vh] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
              <Command.Empty className="px-3 py-8 text-sm text-muted-foreground">
                Nenhum post ou etiqueta para “{search.trim()}”.
              </Command.Empty>

              {!search && (
                <Command.Group heading="navegação">
                  <Command.Item
                    value="arquivo"
                    onSelect={() => handleSelect('/posts')}
                    className={itemClass}
                  >
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Arquivo completo</span>
                  </Command.Item>
                  <Command.Item
                    value="sobre"
                    onSelect={() => handleSelect('/about')}
                    className={itemClass}
                  >
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Sobre</span>
                  </Command.Item>
                </Command.Group>
              )}

              {filteredPosts.length > 0 && (
                <Command.Group heading="posts">
                  {filteredPosts.slice(0, 6).map((post) => (
                    <Command.Item
                      key={post.slug}
                      value={post.slug}
                      onSelect={() => handleSelect(`/posts/${post.slug}`)}
                      className={itemClass}
                    >
                      <SectionSig section={post.section} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{post.title}</p>
                        <p className="truncate text-xs opacity-80">
                          {getSection(post.section)?.one ?? 'Post'}
                          {post.excerpt ? ` · ${post.excerpt}` : ''}
                        </p>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {filteredTags.length > 0 && (
                <Command.Group heading="etiquetas">
                  {filteredTags.slice(0, 8).map((tag) => (
                    <Command.Item
                      key={tag}
                      value={`tag-${tag}`}
                      onSelect={() => handleSelect(`/posts?tag=${encodeURIComponent(tag)}`)}
                      className={itemClass}
                    >
                      <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>#{tag}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 font-mono text-xs text-muted-foreground">
              <span>
                <kbd className="rounded-sm bg-secondary px-1.5 py-0.5">↑↓</kbd> navegar
              </span>
              <span>
                <kbd className="rounded-sm bg-secondary px-1.5 py-0.5">↵</kbd> abrir
              </span>
              <span>
                <kbd className="rounded-sm bg-secondary px-1.5 py-0.5">esc</kbd> fechar
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
