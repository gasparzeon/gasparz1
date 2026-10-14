import { isSafeMediaUrl, postInputSchema, savePostSchema, slugify, todayISO } from '../schema';

const valid = {
  slug: 'meu-post',
  title: 'Meu post',
  excerpt: '',
  publishedAt: '2026-10-12',
  updatedAt: '',
  tags: [],
  coverImage: '',
  content: 'Olá',
};

describe('slugify', () => {
  it.each([
    ['H4CK34NDO AS URNAS!', 'h4ck34ndo-as-urnas'],
    ['Ação & Reação: o básico', 'acao-reacao-o-basico'],
    ['  --espaços--  ', 'espacos'],
    ['El Niño 2026', 'el-nino-2026'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('limita o tamanho sem terminar em hífen', () => {
    const slug = slugify('palavra '.repeat(30));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('isSafeMediaUrl', () => {
  it.each([
    ['/uploads/foto.png', true],
    ['https://x.public.blob.vercel-storage.com/a.mp4', true],
    ['//evil.com/x.png', false],
    ['javascript:alert(1)', false],
    ['data:image/png;base64,AAAA', false],
    ['foto.png', false],
  ])('%s → %s', (url, expected) => {
    expect(isSafeMediaUrl(url)).toBe(expected);
  });
});

describe('postInputSchema', () => {
  it('aceita um post válido e remove tags duplicadas', () => {
    const parsed = postInputSchema.parse({ ...valid, tags: ['ia', 'ia', ' web '] });
    expect(parsed.tags).toEqual(['ia', 'web']);
  });

  it.each([
    ['slug com path traversal', { slug: '../etc/passwd' }],
    ['slug com maiúsculas', { slug: 'Meu-Post' }],
    ['título vazio', { title: '   ' }],
    ['data inválida', { publishedAt: '2026-13-45' }],
    ['data em outro formato', { publishedAt: '12/10/2026' }],
    ['capa com javascript:', { coverImage: 'javascript:alert(1)' }],
    ['tags demais', { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }],
    ['autor que não é UUID', { authorId: '1 OR 1=1' }],
  ])('recusa %s', (_label, override) => {
    expect(postInputSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('todayISO', () => {
  it('usa a data local no formato AAAA-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('savePostSchema', () => {
  it('exige status conhecido e versão numérica', () => {
    expect(
      savePostSchema.safeParse({ post: valid, status: 'review', expectedVersion: 3 }).success,
    ).toBe(true);
    expect(
      savePostSchema.safeParse({ post: valid, status: 'publicado', expectedVersion: null }).success,
    ).toBe(false);
    expect(
      savePostSchema.safeParse({ post: valid, status: 'draft', expectedVersion: 'abc' }).success,
    ).toBe(false);
  });
});
