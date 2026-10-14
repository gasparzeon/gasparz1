/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { ArchiveBrowser, type ArchivePost, type ArchiveFilters } from '../archive-browser';

jest.mock('@/lib/motion/gz-motion', () => ({ countBetween: jest.fn(), staggerIn: jest.fn() }));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const post = (overrides: Partial<ArchivePost>): ArchivePost => ({
  slug: 'post',
  title: 'Post',
  excerpt: '',
  publishedAt: '2026-05-01',
  readingTime: '3 min',
  section: null,
  coverImage: null,
  tags: [],
  number: '#001',
  ...overrides,
});

const POSTS = [
  post({
    slug: 'urnas',
    title: 'H4CK34NDO AS URNAS!',
    publishedAt: '2026-10-01',
    section: 'investigacoes',
    tags: ['eleições'],
    number: '#003',
  }),
  post({
    slug: 'el-nino',
    title: 'O Superguia do El Niño',
    publishedAt: '2026-08-02',
    section: 'pesquisas',
    tags: ['clima'],
    number: '#002',
  }),
  post({
    slug: 'cicada',
    title: 'Cicada 3301',
    publishedAt: '2026-05-12',
    section: 'arquivos',
    tags: ['criptografia'],
    number: '#001',
  }),
];

const show = (initial: Partial<ArchiveFilters> = {}) =>
  render(
    <ArchiveBrowser
      posts={POSTS}
      initial={{ q: '', section: 'all', tag: '', order: 'desc', ...initial }}
      title="Arquivo"
      description="Todos os posts."
    />,
  );

const titles = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('<ArchiveBrowser />', () => {
  beforeEach(() => window.history.replaceState(null, '', '/posts'));

  it('trilha "Início › Arquivo" no topo', () => {
    show();
    const trail = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(trail).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
    expect(within(trail).getByText('Arquivo')).toHaveAttribute('aria-current', 'page');
  });

  it('agrupa por mês, do mais recente ao mais antigo', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Outubro de 20261 post',
      'Agosto de 20261 post',
      'Maio de 20261 post',
    ]);
    expect(titles()).toEqual(['H4CK34NDO AS URNAS!', 'O Superguia do El Niño', 'Cicada 3301']);
  });

  it('busca sem diferenciar acento e atualiza a URL', () => {
    show();
    fireEvent.change(screen.getByLabelText(/Buscar por título/), { target: { value: 'nino' } });
    expect(titles()).toEqual(['O Superguia do El Niño']);
    expect(screen.getByText('1 post para “nino”')).toBeInTheDocument();
    expect(window.location.search).toBe('?q=nino');
  });

  it('filtra por seção com botões que dizem se estão ativos', () => {
    show();
    const group = screen.getByRole('group', { name: 'Filtrar por seção' });
    const button = within(group).getByRole('button', { name: /Arquivos digitais/ });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(titles()).toEqual(['Cicada 3301']);
    expect(window.location.search).toBe('?secao=arquivos');
  });

  it('etiqueta vinda do link, ordem dos mais antigos e limpar filtros', () => {
    show({ tag: 'clima' });
    expect(titles()).toEqual(['O Superguia do El Niño']);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(titles()).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Ordenar'), { target: { value: 'asc' } });
    expect(titles()).toEqual(['Cicada 3301', 'O Superguia do El Niño', 'H4CK34NDO AS URNAS!']);
  });

  it('sem resultados mostra o aviso e o botão de limpar', () => {
    show({ q: 'nada disso' });
    expect(screen.getByText('Nenhum post encontrado.')).toBeInTheDocument();
    expect(titles()).toHaveLength(0);
  });
});
