/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';

import { getCreators, type Creator } from '@/lib/content';

import CreatorsPage, { metadata } from '../page';

jest.mock('@/lib/content', () => ({ getCreators: jest.fn() }));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const creator = (overrides: Partial<Creator>): Creator => ({
  name: 'Gaspar',
  username: 'gaspar',
  avatarUrl: '',
  bio: '',
  socials: [],
  readme: '',
  posts: 0,
  latest: null,
  sections: [],
  ...overrides,
});

async function renderPage() {
  render(await CreatorsPage());
}

describe('/creators', () => {
  it('título e descrição da aba', () => {
    expect(metadata.title).toBe('Creators');
  });

  it('um cartão por pessoa: nome levando à página de autor, números, seções e redes', async () => {
    jest.mocked(getCreators).mockResolvedValue([
      creator({
        bio: 'Investigação e segurança.',
        posts: 3,
        latest: '2026-10-01',
        sections: ['investigacoes', 'pesquisas'],
        socials: [
          { network: 'x', handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' },
        ],
      }),
      creator({ name: 'Ana', username: 'ana', posts: 1, latest: '2026-09-20', readme: '# Oi' }),
    ]);
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Creators' })).toBeInTheDocument();
    expect(screen.getByText('2 creators')).toBeInTheDocument();

    const card = screen.getByRole('article', { name: 'Gaspar' });
    expect(within(card).getByRole('link', { name: 'Gaspar' })).toHaveAttribute(
      'href',
      '/autores/gaspar',
    );
    expect(within(card).getByText('@gaspar')).toBeInTheDocument();
    expect(within(card).getByText('Investigação e segurança.')).toBeInTheDocument();
    expect(within(card).getByText('posts', { exact: false })).toHaveTextContent('3 posts');
    expect(within(card).getByText('01.10.2026')).toHaveAttribute('dateTime', '2026-10-01');

    const sections = within(card).getByRole('list', { name: 'Escreve em' });
    expect(
      within(sections)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Investigações', 'Pesquisas']);
    expect(within(card).getByRole('link', { name: /@gasparzeon X \(Twitter\)/ })).toHaveAttribute(
      'href',
      'https://x.com/gasparzeon',
    );

    expect(within(card).queryByRole('link', { name: /README/ })).not.toBeInTheDocument();

    const ana = screen.getByRole('article', { name: 'Ana' });
    expect(within(ana).getByRole('link', { name: 'Ler o README de Ana' })).toHaveAttribute(
      'href',
      '/autores/ana#readme',
    );
    expect(within(ana).getByText('post', { exact: false })).toHaveTextContent('1 post');
    expect(within(ana).queryByRole('list', { name: /Redes/ })).not.toBeInTheDocument();
  });

  it('sem ninguém ainda', async () => {
    jest.mocked(getCreators).mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText('Ninguém por aqui ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
