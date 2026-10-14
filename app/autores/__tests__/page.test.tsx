/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';

import { getAllPosts, getAuthor, getPostsByAuthor, type PublicAuthor } from '@/lib/content';
import { readmeToHast } from '@/lib/markdown/readme';

import AuthorPage from '../[username]/page';

jest.mock('@/lib/content', () => ({
  getAuthor: jest.fn(),
  getAllPosts: jest.fn(async () => []),
  getPostsByAuthor: jest.fn(async () => []),
}));
jest.mock('@/lib/site/service', () => ({ getSiteSettings: jest.fn() }));
jest.mock('@/lib/markdown/readme', () => ({ readmeToHast: jest.fn() }));
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

const author = (overrides: Partial<PublicAuthor> = {}): PublicAuthor => ({
  name: 'Gaspar',
  username: 'gaspar',
  avatarUrl: '',
  bio: 'Pesquisa e investigação.',
  socials: [],
  readme: '',
  ...overrides,
});

async function renderPage(username = 'gaspar') {
  render(await AuthorPage({ params: Promise.resolve({ username }) }));
}

describe('/autores/[username]', () => {
  it('README do creator num painel "README.md", antes dos posts', async () => {
    jest.mocked(getAuthor).mockResolvedValue(author({ readme: '# Sobre mim' }));
    jest.mocked(readmeToHast).mockResolvedValue({
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'h3',
          properties: {},
          children: [{ type: 'text', value: 'Sobre mim' }],
        },
      ],
    });
    await renderPage();

    const readme = screen.getByRole('region', { name: 'README.md' });
    expect(readme).toHaveAttribute('id', 'readme');
    expect(
      within(readme).getByRole('heading', { level: 3, name: 'Sobre mim' }),
    ).toBeInTheDocument();
    expect(readmeToHast).toHaveBeenCalledWith('# Sobre mim');
    expect(getPostsByAuthor).toHaveBeenCalledWith('gaspar');
    expect(getAllPosts).toHaveBeenCalled();

    // O README vem antes da lista de posts.
    const posts = screen.getByText('0 posts publicados');
    expect(readme.compareDocumentPosition(posts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sem README: nada de painel vazio para quem visita', async () => {
    jest.mocked(getAuthor).mockResolvedValue(author());
    await renderPage();
    expect(screen.queryByRole('region', { name: 'README.md' })).not.toBeInTheDocument();
    expect(readmeToHast).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Gaspar' })).toBeInTheDocument();
  });

  it('redes do perfil logo abaixo da bio', async () => {
    jest.mocked(getAuthor).mockResolvedValue(
      author({
        socials: [
          { network: 'x', handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' },
        ],
      }),
    );
    await renderPage();
    expect(screen.getByRole('list', { name: 'Redes de Gaspar' })).toBeInTheDocument();
  });

  it('trilha: Início › Creators › nome', async () => {
    jest.mocked(getAuthor).mockResolvedValue(author());
    await renderPage();
    const trail = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(trail).getByRole('link', { name: 'Creators' })).toHaveAttribute(
      'href',
      '/creators',
    );
    expect(within(trail).getByText('Gaspar')).toHaveAttribute('aria-current', 'page');
  });

  it('autor que não existe → 404', async () => {
    jest.mocked(getAuthor).mockResolvedValue(null);
    await expect(renderPage('ninguem')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
