import type { Root } from 'hast';
import { Mail } from 'lucide-react';

import { isExternalLink, type SiteSettings } from '@/lib/site/schema';
import type { PageBlock, PageDocument } from '@/lib/site/pages-schema';
import { renderMarkdownTree } from '@/components/markdown/render';
import { cn } from '@/lib/utils';

import { Breadcrumbs } from './breadcrumbs';
import { FeatureIconView, SocialIcon } from './icons';

// Renderiza uma página por blocos. Funciona no servidor (site) e no navegador
// (pré-visualização do painel): os blocos de Markdown chegam já convertidos em
// árvore HTML pelo pipeline do site (`trees`, por id do bloco).

type PageViewProps = {
  page: Pick<PageDocument, 'title' | 'blocks' | 'showBackLink'>;
  settings: Pick<SiteSettings, 'social'>;
  trees: Record<string, Root | undefined>;
};

const externalProps = (href: string) =>
  isExternalLink(href) && !href.startsWith('mailto:')
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

function Hero({ block }: { block: Extract<PageBlock, { type: 'hero' }> }) {
  return (
    <section className="mb-16 grid gap-6">
      {block.kicker && (
        <p className="gz-kicker" data-gz-intro="">
          <b>~/</b>
          {block.kicker}
        </p>
      )}
      <h1 className="gz-h1 max-w-3xl" data-gz-scramble="intro">
        {block.title}
      </h1>
      {block.lead && (
        <p className="gz-lead" data-gz-intro="">
          {block.lead}
        </p>
      )}
    </section>
  );
}

function MarkdownBlock({
  block,
  tree,
}: {
  block: Extract<PageBlock, { type: 'markdown' }>;
  tree: Root | undefined;
}) {
  const body = (
    <div className="gz-prose">
      <div className="prose" data-gz-decode="">
        {tree ? renderMarkdownTree(tree) : null}
      </div>
    </div>
  );
  if (!block.boxed) return <section className="mb-16">{body}</section>;
  return (
    <section className="gz-panel mb-16" data-gz-reveal="">
      {body}
    </section>
  );
}

function Features({ block }: { block: Extract<PageBlock, { type: 'features' }> }) {
  return (
    <section className="mb-16">
      {block.title && (
        <h2 className="gz-h2 mb-8" data-gz-scramble="">
          {block.title}
        </h2>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {block.items.map((item, index) => (
          <div key={index} className="gz-panel" data-gz-reveal="">
            <span className="gz-sec-ico gz-cut mb-4" aria-hidden="true">
              <FeatureIconView icon={item.icon} className="gz-ico" />
            </span>
            <h3 className="gz-h3 mb-2">{item.title}</h3>
            {item.text && <p className="gz-small">{item.text}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Cta({ block }: { block: Extract<PageBlock, { type: 'cta' }> }) {
  return (
    <section className="gz-panel gz-panel--accent mb-16" data-gz-reveal="">
      {block.title && <h2 className="gz-h2 mb-4">{block.title}</h2>}
      {block.text && <p className="gz-lead mb-8 max-w-2xl">{block.text}</p>}
      {block.label && block.href && (
        <a href={block.href} {...externalProps(block.href)} className="gz-btn gz-btn--primary">
          {block.href.startsWith('mailto:') && <Mail className="gz-ico" aria-hidden="true" />}
          {block.label}
        </a>
      )}
    </section>
  );
}

function SocialBlock({
  block,
  social: allLinks,
}: {
  block: Extract<PageBlock, { type: 'social' }>;
  social: SiteSettings['social'];
}) {
  // RSS é feed, não contato: aparece só no rodapé.
  const social = allLinks.filter((link) => link.network !== 'rss');
  return (
    <section className="mb-16">
      {block.title && <h2 className="gz-h2 mb-4">{block.title}</h2>}
      {block.text && <p className="gz-lead mb-6">{block.text}</p>}
      {social.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {social.map((link) => (
            <a
              key={`${link.network}-${link.url}`}
              href={link.url}
              {...externalProps(link.url)}
              className="gz-btn gz-btn--sm"
            >
              <span aria-hidden="true">
                <SocialIcon network={link.network} className="h-4 w-4" />
              </span>
              {link.label || link.url.replace(/^mailto:/, '')}
            </a>
          ))}
        </div>
      ) : (
        <p className="gz-small">Nenhuma rede social configurada.</p>
      )}
    </section>
  );
}

export function PageView({ page, settings, trees }: PageViewProps) {
  const startsWithHero = page.blocks[0]?.type === 'hero';

  return (
    <div className={cn('gz-root gz-wrap', startsWithHero ? 'py-12 md:py-20' : 'py-12')}>
      {/* Trilha em todas as páginas, como no resto do site (substitui o antigo
          link "Voltar ao início", que era opcional). */}
      <Breadcrumbs items={[{ label: page.title }]} />

      {/* Sem bloco de abertura, o título da página vira o h1 (como no Sobre). */}
      {!startsWithHero && (
        <h1 className="gz-h1 mb-10" data-gz-scramble="intro">
          {page.title}
        </h1>
      )}

      {page.blocks.map((block) => {
        switch (block.type) {
          case 'hero':
            return <Hero key={block.id} block={block} />;
          case 'markdown':
            return <MarkdownBlock key={block.id} block={block} tree={trees[block.id]} />;
          case 'features':
            return <Features key={block.id} block={block} />;
          case 'cta':
            return <Cta key={block.id} block={block} />;
          case 'social':
            return <SocialBlock key={block.id} block={block} social={settings.social} />;
        }
      })}
    </div>
  );
}
