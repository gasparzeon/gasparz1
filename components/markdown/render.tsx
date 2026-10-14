import type { ComponentProps, ReactNode } from 'react';
import type { Root } from 'hast';
import { toJsxRuntime, type Components } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';

import { Callout } from './callout';
import { CodeBlock } from './code-block';
import { YouTube } from './youtube';

// Converte a árvore HTML já sanitizada em React. Roda no servidor (site) e
// no navegador (preview do editor), sem dependências exclusivas de servidor.

type DataProps = Record<string, unknown> & { children?: ReactNode };

const str = (value: unknown) => (typeof value === 'string' ? value : undefined);

const CALLOUT_TYPES = ['info', 'warning', 'tip', 'danger'] as const;
type CalloutType = (typeof CALLOUT_TYPES)[number];

function YouTubeEmbed(props: DataProps) {
  return (
    <YouTube
      id={str(props['data-id'])}
      start={str(props['data-start'])}
      caption={str(props['data-caption'])}
    />
  );
}

function CalloutBlock({ children, ...props }: DataProps) {
  const type = str(props['data-type']);
  return (
    <Callout
      type={CALLOUT_TYPES.includes(type as CalloutType) ? (type as CalloutType) : 'info'}
      title={str(props['data-title'])}
    >
      {children}
    </Callout>
  );
}

function Table(props: ComponentProps<'table'>) {
  return (
    <div className="md-table">
      <table {...props} />
    </div>
  );
}

const components = {
  'x-youtube': YouTubeEmbed,
  'x-callout': CalloutBlock,
  table: Table,
  pre: CodeBlock,
} as unknown as Partial<Components>;

export function renderMarkdownTree(tree: Root) {
  return toJsxRuntime(tree, { Fragment, jsx, jsxs, components, passKeys: true });
}
