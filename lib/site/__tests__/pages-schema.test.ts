import { DEFAULT_PAGES } from '../default-pages';
import {
  RESERVED_PAGE_SLUGS,
  emptyBlock,
  pageBlockSchema,
  pageInputSchema,
  type PageBlockType,
} from '../pages-schema';

const page = (overrides: Record<string, unknown> = {}) => ({
  slug: 'contato',
  title: 'Contato',
  description: '',
  showBackLink: false,
  blocks: [],
  ...overrides,
});

describe('páginas padrão', () => {
  it('Sobre e Apoie (antes fixas no código) são válidas', () => {
    expect(DEFAULT_PAGES.map((item) => item.slug)).toEqual(['about', 'support']);
    for (const item of DEFAULT_PAGES) expect(pageInputSchema.parse(item)).toEqual(item);
  });
});

describe('endereço', () => {
  it.each(['admin', 'api', 'posts', 'autores', 'creators', 'uploads', 'rss', 'sitemap'])(
    'recusa o endereço do sistema "%s"',
    (slug) => {
      expect(RESERVED_PAGE_SLUGS.has(slug)).toBe(true);
      expect(pageInputSchema.safeParse(page({ slug })).success).toBe(false);
    },
  );

  it.each(['Contato', 'meu contato', 'contato/', '-contato', 'çontato'])('recusa "%s"', (slug) => {
    expect(pageInputSchema.safeParse(page({ slug })).success).toBe(false);
  });

  it('aceita letras minúsculas, números e hífens', () => {
    expect(pageInputSchema.parse(page({ slug: 'politica-de-privacidade-2026' })).slug).toBe(
      'politica-de-privacidade-2026',
    );
  });
});

describe('blocos', () => {
  it.each<PageBlockType>(['hero', 'markdown', 'features', 'cta', 'social'])(
    'bloco novo "%s" já é válido',
    (type) => {
      expect(pageBlockSchema.safeParse(emptyBlock(type)).success).toBe(true);
    },
  );

  it('recusa tipo desconhecido, botão com link perigoso e ícone inexistente', () => {
    expect(pageBlockSchema.safeParse({ id: 'a', type: 'script', code: 'x' }).success).toBe(false);
    expect(
      pageBlockSchema.safeParse({ ...emptyBlock('cta'), label: 'Ir', href: 'javascript:alert(1)' })
        .success,
    ).toBe(false);
    expect(
      pageBlockSchema.safeParse({
        ...emptyBlock('features'),
        items: [{ icon: 'bomba', title: 'X', text: '' }],
      }).success,
    ).toBe(false);
  });

  it('cada bloco novo ganha um id diferente', () => {
    expect(emptyBlock('markdown').id).not.toBe(emptyBlock('markdown').id);
  });
});
