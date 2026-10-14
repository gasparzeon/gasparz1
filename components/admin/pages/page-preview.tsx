'use client';

import { useEffect, useState } from 'react';
import type { Root } from 'hast';

import { adminFetch } from '@/lib/admin/client';
import type { PageDocument } from '@/lib/site/pages-schema';
import type { SiteSettings } from '@/lib/site/schema';
import { PageView } from '@/components/site/page-blocks';

type PagePreviewProps = {
  page: Pick<PageDocument, 'title' | 'blocks' | 'showBackLink'>;
  social: SiteSettings['social'];
};

// Mesmo renderizador do site; os blocos de texto passam pelo pipeline de
// Markdown do servidor (sanitização, código, fórmulas), como na página real.
export function PagePreview({ page, social }: PagePreviewProps) {
  const [trees, setTrees] = useState<Record<string, Root | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const markdown = page.blocks.flatMap((block) =>
    block.type === 'markdown' ? [{ id: block.id, content: block.content }] : [],
  );
  const signature = JSON.stringify(markdown);

  useEffect(() => {
    const controller = new AbortController();
    const blocks = JSON.parse(signature) as { id: string; content: string }[];
    const timer = window.setTimeout(async () => {
      try {
        const rendered = await Promise.all(
          blocks.map(async (block) => {
            const { tree } = await adminFetch<{ tree: Root }>('/api/admin/preview', {
              method: 'POST',
              body: JSON.stringify({ content: block.content }),
              signal: controller.signal,
            });
            return [block.id, tree] as const;
          }),
        );
        setTrees(Object.fromEntries(rendered));
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      }
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [signature]);

  return (
    <div className="rounded-sm border border-border bg-background">
      {error && (
        <p className="border-b border-red-500/30 bg-red-500/5 px-4 py-2 text-sm text-destructive">
          Não foi possível atualizar a pré-visualização: {error}
        </p>
      )}
      <PageView page={page} settings={{ social }} trees={trees} />
    </div>
  );
}
