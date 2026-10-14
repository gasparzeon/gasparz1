// Seções do arquivo. Cada post pertence a no máximo uma; cada seção tem uma
// forma, que acompanha o post no site inteiro (selo, miniatura, capa gerada)
// para quem lê saber onde está sem depender só de cor.

export const SECTION_KEYS = [
  'investigacoes',
  'pesquisas',
  'arquivos',
  'reflexoes',
  'cultura',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export type SectionShape = 'circle' | 'square' | 'tri' | 'diamond' | 'hex';

export type Section = {
  key: SectionKey;
  // "Investigação" num post, "Investigações" no menu e nos filtros.
  one: string;
  many: string;
  shape: SectionShape;
  // Abreviação de 3 letras usada no terminal da página inicial.
  code: string;
  description: string;
};

export const SECTIONS: readonly Section[] = [
  {
    key: 'investigacoes',
    one: 'Investigação',
    many: 'Investigações',
    shape: 'circle',
    code: 'inv',
    description: 'Alegações, fraudes e mitos checados até a fonte.',
  },
  {
    key: 'pesquisas',
    one: 'Pesquisa',
    many: 'Pesquisas',
    shape: 'square',
    code: 'pes',
    description: 'Fenômenos explicados do começo ao fim, com os dados.',
  },
  {
    key: 'arquivos',
    one: 'Arquivo digital',
    many: 'Arquivos digitais',
    shape: 'tri',
    code: 'arq',
    description: 'Casos e personagens que a internet não pode perder.',
  },
  {
    key: 'reflexoes',
    one: 'Reflexão técnica',
    many: 'Reflexões técnicas',
    shape: 'diamond',
    code: 'ref',
    description: 'Software, sistemas e as ideias por trás deles.',
  },
  {
    key: 'cultura',
    one: 'Documentação cultural',
    many: 'Documentação cultural',
    shape: 'hex',
    code: 'doc',
    description: 'Ferramentas, comunidades e o comportamento online de agora.',
  },
];

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === 'string' && (SECTION_KEYS as readonly string[]).includes(value);
}

export function getSection(key: string | null | undefined): Section | null {
  return SECTIONS.find((section) => section.key === key) ?? null;
}
