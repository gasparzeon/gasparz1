'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';

import {
  canDeletePost,
  canEditPost,
  statusLabel,
  type PostStatus,
  type Role,
} from '@/lib/auth/permissions';
import type { PostSummary } from '@/lib/cms/schema';
import { formatDate } from '@/lib/format';
import { AuthorAvatar } from '@/components/author-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { DeletePostDialog, type DeleteTarget } from './delete-post-dialog';

type Filter = 'all' | PostStatus;

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-sm border px-2 py-0.5 font-mono text-xs',
        status === 'published' &&
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        status === 'review' && 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
        status === 'draft' && 'border-border text-muted-foreground',
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

interface PostsTableProps {
  posts: PostSummary[];
  currentUserId: string;
  role: Role;
  showAuthors: boolean;
}

export function PostsTable({ posts, currentUserId, role, showAuthors }: PostsTableProps) {
  const actor = { id: currentUserId, role };
  const refOf = (post: PostSummary) => ({ authorId: post.author.id, status: post.status });
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [query, setQuery] = useState('');
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const visible = useMemo(
    () =>
      posts.filter(
        (post) => !removed.has(post.id) && (!onlyMine || post.author.id === currentUserId),
      ),
    [posts, removed, onlyMine, currentUserId],
  );

  const count = (status: PostStatus) => visible.filter((post) => post.status === status).length;
  const tabs: { id: Filter; label: string; total: number }[] = [
    { id: 'all', label: 'Todos', total: visible.length },
    { id: 'published', label: 'Publicados', total: count('published') },
    { id: 'review', label: 'Em revisão', total: count('review') },
    { id: 'draft', label: 'Rascunhos', total: count('draft') },
  ];

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return visible.filter((post) => {
      if (filter !== 'all' && post.status !== filter) return false;
      if (!q) return true;
      return normalize(
        `${post.title} ${post.slug} ${post.tags.join(' ')} ${post.author.name}`,
      ).includes(q);
    });
  }, [visible, filter, query]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors',
                  filter === tab.id
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                <span className="text-xs text-muted-foreground tabular-nums">{tab.total}</span>
              </button>
            ))}
          </div>

          {showAuthors && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(event) => setOnlyMine(event.target.checked)}
                className="accent-foreground"
              />
              Só os meus
            </label>
          )}
        </div>

        <label className="relative block lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              showAuthors ? 'Buscar por título, tag ou autor' : 'Buscar por título ou tag'
            }
            className="h-10 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-sm transition-colors outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 dark:bg-input/30"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-sm border-2 border-dashed border-border px-6 py-20 text-center">
          <FileText className="mb-4 h-8 w-8 text-muted-foreground" />
          <p className="mb-1 font-medium">
            {visible.length === 0 ? 'Nenhum post ainda' : 'Nada encontrado'}
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            {visible.length === 0 ? 'Escreva o primeiro texto.' : 'Tente outro termo ou filtro.'}
          </p>
          {visible.length === 0 && (
            <Button asChild>
              <Link href="/admin/posts/new">
                <Plus /> Novo post
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="gz-panel divide-y divide-border p-0">
          {filtered.map((post) => (
            <li key={post.id} className="group relative">
              <Link
                href={
                  canEditPost(actor, refOf(post))
                    ? `/admin/posts/${post.id}`
                    : `/posts/${post.slug}`
                }
                className="flex items-center gap-5 px-5 py-4 pr-14 transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="truncate font-sans text-base font-semibold tracking-normal">
                      {post.title}
                    </h2>
                    <StatusBadge status={post.status} />
                  </div>
                  {post.excerpt && (
                    <p className="mb-2 line-clamp-1 text-sm text-muted-foreground">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {showAuthors && (
                      <>
                        <span className="flex items-center gap-1.5">
                          <AuthorAvatar author={post.author} size={16} />
                          {post.author.id === currentUserId ? 'Você' : post.author.name}
                        </span>
                        <span>·</span>
                      </>
                    )}
                    <span>{post.publishedAt ? formatDate(post.publishedAt) : 'Sem data'}</span>
                    <span>·</span>
                    <span>{post.wordCount.toLocaleString('pt-BR')} palavras</span>
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded bg-secondary px-1.5 py-px">
                        {tag}
                      </span>
                    ))}
                    {post.tags.length > 3 && <span>+{post.tags.length - 3}</span>}
                  </div>
                </div>

                {post.coverImage && (
                  <img
                    src={post.coverImage}
                    alt=""
                    loading="lazy"
                    className="hidden h-16 w-28 shrink-0 rounded-md border border-border object-cover sm:block"
                  />
                )}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`Ações para ${post.title}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEditPost(actor, refOf(post)) && (
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/posts/${post.id}`}>
                        <Pencil /> Editar
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {post.status === 'published' && (
                    <DropdownMenuItem asChild>
                      <a href={`/posts/${post.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink /> Ver no site
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    </DropdownMenuItem>
                  )}
                  {canDeletePost(actor, refOf(post)) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setDeleteTarget({ id: post.id, title: post.title, version: post.version })
                        }
                      >
                        <Trash2 /> Excluir
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <DeletePostDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => {
          setDeleteTarget(null);
          setRemoved((current) => new Set(current).add(id));
          router.refresh();
        }}
      />
    </>
  );
}
