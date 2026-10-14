import { z } from 'zod';

import { SLUG_RE } from '@/lib/cms/schema';

import { isSafeLink } from './schema';

// Páginas institucionais (Sobre, Apoie e as que o admin criar), montadas por
// blocos. Compartilhado entre o editor (cliente) e o servidor.

export const PAGE_STATUSES = ['draft', 'published'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

// Endereços que já são do sistema (rotas do Next e arquivos de public/).
export const RESERVED_PAGE_SLUGS = new Set([
  'admin',
  'api',
  'autores',
  'creators',
  'posts',
  'uploads',
  'fonts',
  'rss',
  'sitemap',
  'robots',
  'icon',
  'apple-icon',
  'favicon',
  'manifest',
  'placeholder',
  'placeholder-logo',
  'placeholder-user',
  'next',
]);

export const FEATURE_ICONS = [
  'shield',
  'eye-off',
  'book-open',
  'heart',
  'mail',
  'sparkles',
  'code',
  'globe',
  'lock',
  'cpu',
  'users',
  'zap',
  'terminal',
  'coffee',
] as const;
export type FeatureIcon = (typeof FEATURE_ICONS)[number];

const text = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
const blockId = z.string().regex(/^[a-z0-9-]{1,40}$/i, 'Identificador de bloco inválido.');

export const pageBlockSchema = z.discriminatedUnion('type', [
  // Abertura grande: chamada, título e texto de apoio.
  z.object({
    id: blockId,
    type: z.literal('hero'),
    kicker: text(60),
    title: text(200).min(1, 'Informe o título do destaque.'),
    lead: text(1000),
  }),
  // Texto livre em Markdown (o mesmo dos posts). "boxed" o coloca num cartão.
  z.object({
    id: blockId,
    type: z.literal('markdown'),
    content: z.string().max(200_000, 'Texto muito longo.'),
    boxed: z.boolean(),
  }),
  // Grade de cartões com ícone, título e texto.
  z.object({
    id: blockId,
    type: z.literal('features'),
    title: text(120),
    items: z
      .array(
        z.object({
          icon: z.enum(FEATURE_ICONS),
          title: text(80).min(1, 'Informe o título do cartão.'),
          text: text(400),
        }),
      )
      .max(12, 'Use no máximo 12 cartões.'),
  }),
  // Caixa de chamada com um botão.
  z.object({
    id: blockId,
    type: z.literal('cta'),
    title: text(120),
    text: text(600),
    label: text(60),
    href: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) => value === '' || isSafeLink(value),
        'Link inválido: use /caminho, https://… ou mailto:',
      ),
  }),
  // Botões de contato com as redes sociais configuradas no site.
  z.object({
    id: blockId,
    type: z.literal('social'),
    title: text(120),
    text: text(400),
  }),
]);

export type PageBlock = z.infer<typeof pageBlockSchema>;
export type PageBlockType = PageBlock['type'];

export const pageInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Informe o endereço da página.')
    .max(60, 'Endereço muito longo.')
    .regex(SLUG_RE, 'Use apenas letras minúsculas, números e hífens.')
    .refine((slug) => !RESERVED_PAGE_SLUGS.has(slug), 'Esse endereço é usado pelo sistema.'),
  title: text(120).min(1, 'Informe o título da página.'),
  description: text(300),
  blocks: z.array(pageBlockSchema).max(40, 'Use no máximo 40 blocos.'),
  // Link "Voltar ao início" no topo da página.
  showBackLink: z.boolean(),
});

export type PageInput = z.infer<typeof pageInputSchema>;

export const savePageSchema = z.object({
  page: pageInputSchema,
  status: z.enum(PAGE_STATUSES),
  // Versão que o editor carregou; null para página nova.
  expectedVersion: z.number().int().positive().nullable(),
});

export type PageDocument = PageInput & {
  id: string;
  status: PageStatus;
  version: number;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
};

export type PageSummary = Pick<
  PageDocument,
  'id' | 'slug' | 'title' | 'status' | 'version' | 'updatedAt' | 'updatedBy'
>;

export function newBlockId() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyBlock(type: PageBlockType): PageBlock {
  const id = newBlockId();
  switch (type) {
    case 'hero':
      return { id, type, kicker: '', title: 'Título da página', lead: '' };
    case 'markdown':
      return { id, type, content: '', boxed: false };
    case 'features':
      return { id, type, title: '', items: [{ icon: 'sparkles', title: 'Novo cartão', text: '' }] };
    case 'cta':
      return { id, type, title: '', text: '', label: '', href: '' };
    case 'social':
      return { id, type, title: 'Contato', text: '' };
  }
}
