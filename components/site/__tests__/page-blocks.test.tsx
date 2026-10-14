/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import type { Root } from 'hast';

import { DEFAULT_PAGES } from '@/lib/site/default-pages';
import { DEFAULT_SITE_SETTINGS } from '@/lib/site/schema';
import type { PageBlock } from '@/lib/site/pages-schema';

import { PageView } from '../page-blocks';

jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const tree = (text: string) =>
  ({
    type: 'root',
    children: [
      { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: text }] },
    ],
  }) as unknown as Root;

const show = (
  blocks: PageBlock[],
  extra: Partial<{ title: string; showBackLink: boolean }> = {},
  trees = {},
) =>
  render(
    <PageView
      page={{ title: 'Página', showBackLink: false, blocks, ...extra }}
      settings={DEFAULT_SITE_SETTINGS}
      trees={trees}
    />,
  );

describe('<PageView />', () => {
  it('sem bloco de abertura, o título da página vira o h1', () => {
    show(
      [{ id: 't', type: 'markdown', content: 'Olá', boxed: false }],
      { title: 'Sobre' },
      { t: tree('Olá') },
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Sobre' })).toBeInTheDocument();
    expect(screen.getByText('Olá')).toBeInTheDocument();
  });

  it('com abertura, o h1 é o título do bloco (e não se repete)', () => {
    show([{ id: 'h', type: 'hero', kicker: 'Apoie', title: 'Sustente pesquisa', lead: 'Texto' }], {
      title: 'Apoie',
    });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sustente pesquisa');
    expect(screen.getByText('Apoie', { selector: '.gz-kicker' })).toBeInTheDocument();
  });

  it('toda página tem a trilha "Início › página" (era o link opcional de voltar)', () => {
    show([{ id: 't', type: 'markdown', content: 'x', boxed: false }], {
      title: 'Sobre',
      showBackLink: false,
    });
    const trail = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(trail).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
    expect(within(trail).getByText('Sobre')).toHaveAttribute('aria-current', 'page');
  });

  it('texto em cartão ganha a caixa com borda', () => {
    const { container } = show(
      [{ id: 'b', type: 'markdown', content: 'x', boxed: true }],
      {},
      { b: tree('Dentro da caixa') },
    );
    expect(screen.getByText('Dentro da caixa').closest('section')).toHaveClass('gz-panel');
    expect(container.querySelectorAll('section')).toHaveLength(1);
  });

  it('cartões, chamada com e-mail e link de voltar', () => {
    show(
      [
        {
          id: 'f',
          type: 'features',
          title: 'O que sustenta',
          items: [{ icon: 'shield', title: 'Independência', text: 'Sem anúncios.' }],
        },
        {
          id: 'c',
          type: 'cta',
          title: 'Como apoiar',
          text: 'Escreva.',
          label: 'eu@x.com',
          href: 'mailto:eu@x.com',
        },
      ],
      { showBackLink: true },
    );
    expect(screen.getByRole('heading', { name: 'Independência' })).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /eu@x\.com/ });
    expect(cta).toHaveAttribute('href', 'mailto:eu@x.com');
    expect(cta).not.toHaveAttribute('target');
    // O antigo "Voltar ao início" virou a trilha (um link para o início, não dois).
    expect(screen.getAllByRole('link', { name: 'Início' })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Voltar ao início/ })).not.toBeInTheDocument();
  });

  it('botão externo abre em nova aba com rel seguro', () => {
    show([
      { id: 'c', type: 'cta', title: '', text: '', label: 'GitHub', href: 'https://github.com/x' },
    ]);
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('contatos mostram as redes do site, menos o RSS', () => {
    show([{ id: 's', type: 'social', title: 'Contato', text: 'Me encontre:' }]);
    const contact = screen.getByRole('heading', { name: 'Contato' }).closest('section')!;
    const links = within(contact)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(links).toEqual([
      'https://instagram.com/gasparzeon',
      'https://discord.com/users/1360367947385798810',
      'mailto:h4xcats@gmail.com',
    ]);
  });

  it('renderiza as páginas padrão (Sobre e Apoie) sem erro', () => {
    for (const page of DEFAULT_PAGES) {
      const { unmount } = render(
        <PageView page={page} settings={DEFAULT_SITE_SETTINGS} trees={{}} />,
      );
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      unmount();
    }
  });
});
