/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';

import { getAllPosts, getAuthor, getPostBySlug, type PublicAuthor } from '@/lib/content';
import { databaseKind } from '@/lib/db';
import { DEFAULT_SITE_SETTINGS } from '@/lib/site/schema';

import PostPage, { generateStaticParams } from '../page';

// Página servidora com dados, banco e componentes pesados mockados: o foco é o
// bloco "Quem escreveu" (com as redes do perfil) no fim do post.
jest.mock('@/lib/content', () => ({
  getAllPosts: jest.fn(),
  getAuthor: jest.fn(),
  getPostBySlug: jest.fn(),
}));
jest.mock('@/lib/site/service', () => ({
  getSiteSettings: jest.fn(async () => DEFAULT_SITE_SETTINGS),
}));
jest.mock('@/lib/db', () => ({ databaseKind: jest.fn(() => 'postgres') }));
jest.mock('@/components/post-content', () => ({
  PostContent: ({ content }: { content: string }) => <p>{content}</p>,
}));
jest.mock('@/components/comments', () => ({ Comments: () => null }));
jest.mock('@/components/site/post-side', () => ({ PostSide: () => null }));
jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const AUTHOR = {
  name: 'Gaspar Zeon',
  username: 'gaspar',
  avatarUrl: '',
  bio: 'Pesquisa segurança e eleições.',
};

const POST = {
  slug: 'h4ck34ndo-as-urnas',
  title: 'H4CK34NDO AS URNAS!',
  excerpt: 'Como a urna é testada.',
  publishedAt: '2026-10-01',
  updatedAt: '',
  tags: ['urnas'],
  section: 'investigacoes' as const,
  draft: false,
  coverImage: null,
  readingTime: '8 min',
  author: AUTHOR,
  content: 'Texto do post.',
};

const writer = (overrides: Partial<PublicAuthor> = {}): PublicAuthor => ({
  ...AUTHOR,
  socials: [
    { network: 'x', handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' },
    {
      network: 'instagram',
      handle: 'gaspar.labs',
      url: 'https://www.instagram.com/gaspar.labs/',
      label: '',
    },
  ],
  readme: '',
  ...overrides,
});

async function renderPage(slug = POST.slug) {
  render(await PostPage({ params: Promise.resolve({ slug }) }));
}

const writerBlock = () =>
  screen.getByRole('heading', { level: 2, name: 'Quem escreveu' }).parentElement as HTMLElement;

beforeEach(() => {
  jest.mocked(getPostBySlug).mockResolvedValue(POST);
  jest.mocked(getAllPosts).mockResolvedValue([POST]);
  jest.mocked(getAuthor).mockResolvedValue(writer());
});

describe('/posts/[slug] — Quem escreveu', () => {
  it('nome levando à página de autor, bio e as redes do perfil', async () => {
    await renderPage();
    const block = writerBlock();

    expect(within(block).getByRole('link', { name: 'Gaspar Zeon' })).toHaveAttribute(
      'href',
      '/autores/gaspar',
    );
    expect(within(block).getByText('Pesquisa segurança e eleições.')).toBeInTheDocument();

    const socials = within(block).getByRole('list', { name: 'Redes de Gaspar Zeon' });
    expect(
      within(socials)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['https://x.com/gasparzeon', 'https://www.instagram.com/gaspar.labs/']);
    expect(getAuthor).toHaveBeenCalledWith('gaspar');
  });

  it('autor sem redes: só nome e bio, sem lista vazia', async () => {
    jest.mocked(getAuthor).mockResolvedValue(writer({ socials: [] }));
    await renderPage();
    expect(within(writerBlock()).queryByRole('list')).not.toBeInTheDocument();
  });

  it('autor que deixou de escrever (perfil não público): o bloco continua, sem redes', async () => {
    jest.mocked(getAuthor).mockResolvedValue(null);
    await renderPage();
    const block = writerBlock();
    expect(within(block).getByRole('link', { name: 'Gaspar Zeon' })).toBeInTheDocument();
    expect(within(block).queryByRole('list')).not.toBeInTheDocument();
  });

  it('post que não existe → 404 (e não procura autor)', async () => {
    jest.mocked(getPostBySlug).mockResolvedValue(null);
    await expect(renderPage('nao-existe')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getAuthor).not.toHaveBeenCalled();
  });
});

describe('/posts/[slug] — trilha', () => {
  it('Início › seção do post › título (atual)', async () => {
    await renderPage();
    const trail = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(trail).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
    expect(within(trail).getByRole('link', { name: 'Investigações' })).toHaveAttribute(
      'href',
      '/posts?secao=investigacoes',
    );
    expect(within(trail).getByText('H4CK34NDO AS URNAS!')).toHaveAttribute('aria-current', 'page');
  });

  it('post sem seção: o meio da trilha é o arquivo', async () => {
    jest.mocked(getPostBySlug).mockResolvedValue({ ...POST, section: null });
    await renderPage();
    const trail = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(trail).getByRole('link', { name: 'Arquivo' })).toHaveAttribute('href', '/posts');
  });
});

describe('generateStaticParams', () => {
  it('com Postgres, gera as páginas de todos os posts', async () => {
    await expect(generateStaticParams()).resolves.toEqual([{ slug: POST.slug }]);
  });

  it('com PGlite (um processo só), renderiza sob demanda', async () => {
    jest.mocked(databaseKind).mockReturnValue('pglite');
    await expect(generateStaticParams()).resolves.toEqual([]);
    expect(getAllPosts).not.toHaveBeenCalled();
  });
});
