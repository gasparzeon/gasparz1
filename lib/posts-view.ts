import type { Post } from '@/lib/content';
import { getSection, SECTIONS, type SectionKey, type SectionShape } from '@/lib/sections';

// Apoio às listas do site: numeração de registro, datas curtas, meses e
// contagens. Funções puras, usadas no servidor e no cliente.

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export const SHAPE_CLASS: Record<SectionShape, string> = {
  circle: 'gz-k-circle',
  square: 'gz-k-square',
  tri: 'gz-k-tri',
  diamond: 'gz-k-diamond',
  hex: 'gz-k-hex',
};

export function shapeClassFor(section: SectionKey | null | undefined) {
  const shape = getSection(section)?.shape ?? 'square';
  // eslint-disable-next-line security/detect-object-injection -- shape vem da lista fixa de seções
  return SHAPE_CLASS[shape];
}

// Número de registro (#001 = o post mais antigo). Muda só se um post sair do ar.
export function registryNumbers(posts: Pick<Post, 'slug' | 'publishedAt'>[]) {
  const ordered = [...posts].sort(
    (a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.slug.localeCompare(b.slug),
  );
  return new Map(
    ordered.map((post, index) => [post.slug, `#${String(index + 1).padStart(3, '0')}`]),
  );
}

// "2026-10-01" → "01.10.2026"
export function shortDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}.${month}.${year}` : iso;
}

// "2026-10-01" → "1 de outubro de 2026"
export function longDate(iso: string) {
  const [year, month, day] = iso.split('-');
  const name = MONTHS[Number(month) - 1];
  return year && name && day ? `${Number(day)} de ${name} de ${year}` : iso;
}

// "2026-10-01" → "Outubro de 2026"
export function monthLabel(iso: string) {
  const [year, month] = iso.split('-');
  const name = MONTHS[Number(month) - 1] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`;
}

// Título curto para o letreiro: o trecho antes de ":".
export function shortTitle(title: string) {
  const [head] = title.split(':');
  return (head ?? title).trim();
}

export function minutesOf(readingTime: string) {
  return Number.parseInt(readingTime, 10) || 0;
}

export function sectionCounts(posts: Pick<Post, 'section'>[]) {
  return Object.fromEntries(
    SECTIONS.map((section) => [
      section.key,
      posts.filter((post) => post.section === section.key).length,
    ]),
  ) as Record<SectionKey, number>;
}

export const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;
