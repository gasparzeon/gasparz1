import 'server-only';

import type { Element, Root } from 'hast';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import remarkGemoji from 'remark-gemoji';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { rehypeTaskList } from './task-list';

// Markdown do README dos creators: bem mais restrito que o dos posts.
// - títulos, parágrafos, negrito/itálico/riscado, links, listas (com caixas de
//   seleção), citações, código e linha divisória;
// - nada de HTML embutido (é descartado), imagens, tabelas ou ids;
// - títulos rebaixados dois níveis (# vira h3): na página, o README fica
//   abaixo do nome da pessoa (h1/h2) e não bagunça a estrutura de títulos;
// - links com rel="nofollow ugc": conteúdo escrito por quem usa o site.

const README_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    'p',
    'br',
    'strong',
    'em',
    'del',
    'a',
    'ul',
    'ol',
    'li',
    'input',
    'code',
    'pre',
    'blockquote',
    'hr',
    'h3',
    'h4',
    'h5',
    'h6',
  ],
  attributes: {
    a: ['href'],
    ul: [['className', 'contains-task-list']],
    li: [['className', 'task-list-item']],
    input: [['type', 'checkbox'], ['disabled', true], 'checked'],
    code: [['className', /^language-./]],
  },
  protocols: { href: ['http', 'https', 'mailto'] },
  strip: ['script', 'style'],
};

type MdNode = { type: string; depth?: number; children?: MdNode[] };

function demoteHeadings() {
  const walk = (node: MdNode) => {
    if (node.type === 'heading' && typeof node.depth === 'number') {
      node.depth = Math.min(node.depth + 2, 6);
    }
    node.children?.forEach(walk);
  };
  return (tree: MdNode) => walk(tree);
}

function ugcLinks() {
  const walk = (node: Root | Element) => {
    node.children.forEach((child) => {
      if (child.type !== 'element') return;
      if (child.tagName === 'a') {
        child.properties = {
          ...child.properties,
          rel: ['nofollow', 'ugc', 'noopener', 'noreferrer'],
        };
      }
      walk(child);
    });
  };
  return (tree: Root) => walk(tree);
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkGemoji)
  .use(demoteHeadings)
  // Sem allowDangerousHtml: HTML escrito no README não chega à página.
  .use(remarkRehype)
  .use(rehypeSanitize, README_SCHEMA)
  .use(rehypeTaskList)
  .use(ugcLinks)
  .freeze();

export async function readmeToHast(source: string): Promise<Root> {
  const tree = processor.parse(source);
  return (await processor.run(tree)) as Root;
}
