import { z } from 'zod';

import { POST_STATUSES, type PostStatus } from '@/lib/auth/permissions';
import { SECTION_KEYS } from '@/lib/sections';

// Compartilhado entre o editor (cliente) e a API (servidor).

// eslint-disable-next-line security/detect-unsafe-regex -- o hífen separa os grupos de forma inequívoca: casamento linear
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function todayISO() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Caminho relativo do próprio site ou URL http(s). Bloqueia javascript:,
// data: e afins em capas e mídias.
export function isSafeMediaUrl(value: string) {
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const isoDate = z
  .string()
  .regex(DATE_RE, 'Use o formato AAAA-MM-DD')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Data inválida');

export const postInputSchema = z.object({
  slug: z
    .string()
    .min(1, 'Informe o slug')
    .max(100, 'Slug muito longo')
    .regex(SLUG_RE, 'Use apenas letras minúsculas, números e hífens'),
  title: z.string().trim().min(1, 'Informe o título').max(200, 'Título muito longo'),
  excerpt: z.string().trim().max(500, 'Resumo muito longo').default(''),
  publishedAt: isoDate,
  // "Atualizado em", exibido no post (opcional).
  updatedAt: z.union([isoDate, z.literal('')]).default(''),
  tags: z
    .array(z.string().trim().min(1).max(40, 'Tag muito longa'))
    .max(20, 'Máximo de 20 tags')
    .default([])
    .transform((tags) => Array.from(new Set(tags))),
  coverImage: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === '' || isSafeMediaUrl(value), 'URL de imagem inválida')
    .default(''),
  // Seção do arquivo (lib/sections.ts); vazio = sem seção.
  section: z.union([z.enum(SECTION_KEYS), z.literal('')]).default(''),
  // Markdown (CommonMark + GFM).
  content: z.string().max(1_000_000, 'Conteúdo muito longo'),
  // Só editores podem atribuir o post a outra pessoa.
  authorId: z.string().uuid().optional(),
});

export type PostInput = z.infer<typeof postInputSchema>;

export const savePostSchema = z.object({
  post: postInputSchema,
  status: z.enum(POST_STATUSES),
  // Versão que o editor carregou; null para post novo.
  expectedVersion: z.number().int().positive().nullable(),
});

export type PostAuthor = { id: string; name: string; username: string; avatarUrl: string };

export type PostDocument = Omit<PostInput, 'authorId'> & {
  id: string;
  status: PostStatus;
  version: number;
  author: PostAuthor;
  modifiedAt: string;
};

export type PostSummary = Omit<PostDocument, 'content'> & { wordCount: number };
