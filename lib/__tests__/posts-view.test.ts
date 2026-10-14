import { getSection, isSectionKey, SECTION_KEYS, SECTIONS } from '@/lib/sections';
import {
  longDate,
  minutesOf,
  monthLabel,
  plural,
  registryNumbers,
  sectionCounts,
  shapeClassFor,
  shortDate,
  shortTitle,
} from '@/lib/posts-view';

describe('seções', () => {
  it('cada seção tem chave, nomes, forma e código únicos', () => {
    expect(SECTIONS.map((s) => s.key)).toEqual([...SECTION_KEYS]);
    expect(new Set(SECTIONS.map((s) => s.shape)).size).toBe(SECTIONS.length);
    expect(new Set(SECTIONS.map((s) => s.code)).size).toBe(SECTIONS.length);
  });

  it('valida a chave e encontra a seção', () => {
    expect(isSectionKey('investigacoes')).toBe(true);
    expect(isSectionKey('Investigações')).toBe(false);
    expect(isSectionKey(null)).toBe(false);
    expect(getSection('cultura')?.many).toBe('Documentação cultural');
    expect(getSection('')).toBeNull();
  });
});

describe('apoio às listas', () => {
  const posts = [
    { slug: 'c', publishedAt: '2026-10-01', section: 'investigacoes' as const },
    { slug: 'b', publishedAt: '2026-05-14', section: null },
    { slug: 'a', publishedAt: '2026-05-14', section: 'investigacoes' as const },
    { slug: 'z', publishedAt: '2026-02-13', section: 'pesquisas' as const },
  ];

  it('numera do mais antigo (#001) ao mais novo, desempatando pelo slug', () => {
    const numbers = registryNumbers(posts);
    expect(numbers.get('z')).toBe('#001');
    expect(numbers.get('a')).toBe('#002');
    expect(numbers.get('b')).toBe('#003');
    expect(numbers.get('c')).toBe('#004');
  });

  it('conta posts por seção', () => {
    expect(sectionCounts(posts)).toMatchObject({ investigacoes: 2, pesquisas: 1, cultura: 0 });
  });

  it('formata datas, meses, títulos curtos e minutos', () => {
    expect(shortDate('2026-10-01')).toBe('01.10.2026');
    expect(longDate('2026-10-01')).toBe('1 de outubro de 2026');
    expect(monthLabel('2026-03-09')).toBe('Março de 2026');
    expect(shortTitle('Cicada 3301: O Maior Mistério')).toBe('Cicada 3301');
    expect(shortTitle('Sem dois pontos')).toBe('Sem dois pontos');
    expect(minutesOf('8 min')).toBe(8);
    expect(plural(1, 'post', 'posts')).toBe('1 post');
    expect(plural(2, 'post', 'posts')).toBe('2 posts');
  });

  it('forma da seção, com quadrado para quem não tem seção', () => {
    expect(shapeClassFor('investigacoes')).toBe('gz-k-circle');
    expect(shapeClassFor('arquivos')).toBe('gz-k-tri');
    expect(shapeClassFor(null)).toBe('gz-k-square');
  });
});
