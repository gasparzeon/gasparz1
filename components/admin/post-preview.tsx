'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import type { Root } from 'hast';
import { AlertTriangle } from 'lucide-react';

import { adminFetch } from '@/lib/admin/client';
import { formatDate } from '@/lib/format';
import { AuthorAvatar } from '@/components/author-avatar';
import { renderMarkdownTree } from '@/components/markdown/render';
import { Spinner } from '@/components/ui/spinner';

class RenderBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function readingMinutes(content: string) {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

interface PostPreviewProps {
  title: string;
  content: string;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  coverImage: string;
  author: { name: string; avatarUrl: string };
}

// O servidor renderiza com o mesmo pipeline do site (sanitização, Shiki,
// KaTeX) e devolve a árvore; aqui ela vira React com os mesmos componentes.
export function PostPreview({
  title,
  content,
  tags,
  publishedAt,
  updatedAt,
  coverImage,
  author,
}: PostPreviewProps) {
  const [rendered, setRendered] = useState<{ tree: Root; revision: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await adminFetch<{ tree: Root }>('/api/admin/preview', {
          method: 'POST',
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });
        setRendered((previous) => ({ tree: data.tree, revision: (previous?.revision ?? 0) + 1 }));
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [content]);

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-12">
        {tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="mb-4">{title || 'Sem título'}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2 text-foreground/80">
            <AuthorAvatar author={author} size={24} />
            {author.name}
          </span>
          <span className="text-border">•</span>
          <span>{publishedAt ? formatDate(publishedAt) : 'Sem data'}</span>
          <span className="text-border">•</span>
          <span>{readingMinutes(content)} min de leitura</span>
          {updatedAt && (
            <>
              <span className="text-border">•</span>
              <span>Atualizado em {formatDate(updatedAt)}</span>
            </>
          )}
          {loading && <Spinner className="h-3.5 w-3.5" />}
        </div>

        {coverImage && (
          <img
            src={coverImage}
            alt=""
            className="mt-10 aspect-[2/1] w-full rounded-xl border border-border object-cover"
          />
        )}
      </header>

      {error && (
        <div className="mb-8 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Não foi possível atualizar a pré-visualização: {error}
        </div>
      )}

      <div className="prose prose-invert max-w-none">
        {rendered && (
          <RenderBoundary key={rendered.revision} onError={setError}>
            {renderMarkdownTree(rendered.tree)}
          </RenderBoundary>
        )}
      </div>
    </article>
  );
}
