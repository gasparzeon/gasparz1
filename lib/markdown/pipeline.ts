import 'server-only';

import type { Root } from 'hast';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import remarkGemoji from 'remark-gemoji';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { rehypeMedia } from './rehype-media';
import { sanitizeSchema } from './sanitize-schema';
import { rehypeTaskList } from './task-list';

// Markdown completo:
// - CommonMark + GFM (tabelas, checklists, riscado, autolinks, notas de rodapé)
// - HTML embutido, sanitizado (posts vêm de vários autores)
// - fórmulas com $$...$$ (um $ só fica como texto: "R$ 10" não vira fórmula)
// - :emoji:, alertas > [!TIP], destaque de sintaxe (Shiki), âncoras nos títulos
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath, { singleDollarTextMath: false })
  .use(remarkGemoji)
  .use(remarkRehype, {
    allowDangerousHtml: true,
    footnoteLabel: 'Notas',
    footnoteBackLabel: 'Voltar ao texto',
  })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  // Daqui para baixo só entram elementos gerados pelo próprio pipeline.
  .use(rehypeMedia)
  .use(rehypeTaskList)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, {
    behavior: 'append',
    properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
    content: { type: 'text', value: '#' },
  })
  .use(rehypeKatex)
  .use(rehypePrettyCode, {
    theme: { dark: 'github-dark-dimmed', light: 'github-light' },
    keepBackground: false,
    defaultLang: { block: 'plaintext', inline: 'plaintext' },
  })
  .freeze();

export async function markdownToHast(source: string): Promise<Root> {
  const tree = processor.parse(source);
  return (await processor.run(tree)) as Root;
}

// Remove posições e metadados antes de enviar a árvore ao navegador.
export function stripPositions<T>(node: T): T {
  if (Array.isArray(node)) return node.map(stripPositions) as T;
  if (node && typeof node === 'object') {
    const { position: _position, data: _data, ...rest } = node as Record<string, unknown>;
    void _position;
    void _data;
    return Object.fromEntries(
      Object.entries(rest).map(([key, value]) => [key, stripPositions(value)]),
    ) as T;
  }
  return node;
}
