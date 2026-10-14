import Link from 'next/link';

import { listComments } from '@/lib/comments/service';
import type { SiteSettings } from '@/lib/site/schema';

import { CommentsSection } from './comments-client';

type CommentsConfig = Pick<SiteSettings['integrations']['comments'], 'enabled' | 'title'>;

// A página do post é estática (ISR): o servidor entrega só a lista, que é
// igual para todo mundo. Quem está logado, formulário e ações aparecem no
// cliente (CommentsSection), sem vazar sessão para o HTML estático.
export async function Comments({ postSlug, config }: { postSlug: string; config: CommentsConfig }) {
  if (!config.enabled) return null;

  const { comments } = await listComments(postSlug);

  return (
    <section className="mt-16" aria-label={config.title || 'Comentários'}>
      <CommentsSection
        postSlug={postSlug}
        title={config.title || 'Comentários'}
        initial={comments}
      />
      <noscript>
        <p className="mt-8 rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          <Link href="/admin/cadastro" className="text-foreground underline underline-offset-4">
            Crie uma conta
          </Link>{' '}
          ou{' '}
          <a
            href={`/api/auth/login?returnTo=${encodeURIComponent(`/posts/${postSlug}`)}`}
            className="text-foreground underline underline-offset-4"
          >
            entre
          </a>{' '}
          para comentar.
        </p>
      </noscript>
    </section>
  );
}
