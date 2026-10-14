import type { Element, ElementContent, Properties, Root } from 'hast';
import { SKIP, visit } from 'unist-util-visit';

import { isVideoUrl } from '@/lib/cms/media-types';

import { parseYouTube } from './youtube';

// Roda DEPOIS do rehype-sanitize: os elementos criados aqui são confiáveis.
//
// - parágrafo só com imagem(ns) vira <figure> (legenda = título da imagem)
// - imagem apontando para .mp4/.webm vira <video>
// - imagem ou link sozinho do YouTube vira o embed <x-youtube>
// - alertas do GitHub (> [!TIP]) viram <x-callout>
// - links externos abrem em nova aba com rel seguro

const ALERTS = new Map([
  ['note', { type: 'info', title: 'Nota' }],
  ['tip', { type: 'tip', title: 'Dica' }],
  ['important', { type: 'info', title: 'Importante' }],
  ['warning', { type: 'warning', title: 'Atenção' }],
  ['caution', { type: 'danger', title: 'Cuidado' }],
]);

const PREFIX = 'user-content-';
const DOUBLE_PREFIX = PREFIX + PREFIX;

const ALERT_RE = /^\s*\[!(note|tip|important|warning|caution)\][ \t]*\n?/i;

function element(
  tagName: string,
  properties: Properties = {},
  children: ElementContent[] = [],
): Element {
  return { type: 'element', tagName, properties, children };
}

const text = (value: string): ElementContent => ({ type: 'text', value });

function isBlank(node: ElementContent) {
  return node.type === 'text' && !node.value.trim();
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

function youtube(url: string, caption?: string) {
  const video = /^https?:\/\//i.test(url) ? parseYouTube(url) : null;
  if (!video) return null;
  return element('x-youtube', {
    dataId: video.id,
    dataStart: video.start ? String(video.start) : undefined,
    dataCaption: caption || undefined,
  });
}

function figure(media: Element, caption?: string) {
  return element('figure', { className: ['md-figure'] }, [
    media,
    ...(caption ? [element('figcaption', {}, [text(caption)])] : []),
  ]);
}

function mediaFromImage(image: Element): Element {
  const src = typeof image.properties.src === 'string' ? image.properties.src : '';
  const alt = typeof image.properties.alt === 'string' ? image.properties.alt : '';
  const title = typeof image.properties.title === 'string' ? image.properties.title : '';

  // O sanitize remove src com protocolo perigoso: sem src, deixa como está.
  if (!src) return image;

  const embed = youtube(src, title || alt);
  if (embed) return embed;

  if (isVideoUrl(src)) {
    return figure(
      element('video', { src, controls: true, playsInline: true, preload: 'metadata' }, [
        element('a', { href: src }, [text('Baixar vídeo')]),
      ]),
      title || alt,
    );
  }

  return figure(
    element('img', { ...image.properties, title: undefined, loading: 'lazy', decoding: 'async' }),
    title,
  );
}

// Parágrafo que é só mídia (imagens ou um link do YouTube) vira bloco.
function blockMedia(paragraph: Element): Element[] | null {
  const children = paragraph.children.filter((child) => !isBlank(child));
  if (children.length === 0) return null;

  if (children.every((child) => child.type === 'element' && child.tagName === 'img')) {
    return children.map((child) => mediaFromImage(child as Element));
  }

  const [only] = children;
  if (children.length === 1 && only.type === 'element' && only.tagName === 'a') {
    const href = typeof only.properties.href === 'string' ? only.properties.href : '';
    if (href && textOf(only).trim() === href) {
      const embed = youtube(href);
      if (embed) return [embed];
    }
  }

  return null;
}

function alertFrom(blockquote: Element): Element | null {
  const first = blockquote.children.find((child) => !isBlank(child));
  if (!first || first.type !== 'element' || first.tagName !== 'p') return null;

  const lead = first.children[0];
  if (!lead || lead.type !== 'text') return null;

  const match = lead.value.match(ALERT_RE);
  const alert = match ? ALERTS.get(match[1].toLowerCase()) : undefined;
  if (!match || !alert) return null;

  lead.value = lead.value.slice(match[0].length);
  // Quebra de linha (<br>) logo após o marcador.
  if (!lead.value && first.children[1]?.type === 'element' && first.children[1].tagName === 'br') {
    first.children.splice(1, 1);
  }

  const children = blockquote.children.filter(
    (child) => !(child === first && first.children.every(isBlank)),
  );

  return element('x-callout', { dataType: alert.type, dataTitle: alert.title }, children);
}

export function rehypeMedia() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index === undefined) return;

      if (node.tagName === 'p') {
        const replacement = blockMedia(node);
        if (replacement) {
          parent.children.splice(index, 1, ...replacement);
          return [SKIP, index + replacement.length];
        }
      }

      if (node.tagName === 'blockquote') {
        const callout = alertFrom(node);
        if (callout) parent.children.splice(index, 1, callout);
      }

      // remark-rehype já prefixa os ids das notas de rodapé e o sanitize
      // prefixa de novo; os hrefs usam um prefixo só.
      if (typeof node.properties.id === 'string' && node.properties.id.startsWith(DOUBLE_PREFIX)) {
        node.properties.id = node.properties.id.slice(PREFIX.length);
      }

      if (node.tagName === 'img') {
        node.properties.loading = 'lazy';
        node.properties.decoding = 'async';
      }

      if (node.tagName === 'a') {
        const href = typeof node.properties.href === 'string' ? node.properties.href : '';
        if (/^https?:\/\//i.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = ['noopener', 'noreferrer'];
        }
      }
    });
  };
}
