/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import type { Root } from 'hast';

import { ReadmeView } from '../readme';

const TREE: Root = {
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'h3',
      properties: {},
      children: [{ type: 'text', value: 'Sobre mim' }],
    },
    {
      type: 'element',
      tagName: 'p',
      properties: {},
      children: [
        { type: 'text', value: 'Veja ' },
        {
          type: 'element',
          tagName: 'a',
          properties: { href: 'https://gaspar.dev', rel: ['nofollow', 'ugc'] },
          children: [{ type: 'text', value: 'meu site' }],
        },
      ],
    },
  ],
};

describe('<ReadmeView />', () => {
  it('monta a árvore já sanitizada como HTML, dentro do corpo do README', () => {
    const { container } = render(<ReadmeView tree={TREE} className="extra" />);
    expect(container.firstChild).toHaveClass('gz-readme-body', 'extra');
    expect(screen.getByRole('heading', { level: 3, name: 'Sobre mim' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'meu site' })).toHaveAttribute('rel', 'nofollow ugc');
  });

  it('árvore vazia: só o contêiner', () => {
    const { container } = render(<ReadmeView tree={{ type: 'root', children: [] }} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
