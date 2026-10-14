/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Root } from 'hast';

import { renderMarkdownTree } from '../render';

// Árvores HTML montadas à mão, no formato que o pipeline entrega.
const el = (
  tagName: string,
  properties: Record<string, unknown> = {},
  children: unknown[] = [],
) => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const text = (value: string) => ({ type: 'text', value });
const tree = (...children: unknown[]) => ({ type: 'root', children }) as unknown as Root;
const show = (root: Root) => render(<>{renderMarkdownTree(root)}</>);

describe('renderMarkdownTree', () => {
  it('<x-youtube> vira o embed leve, com legenda e início', () => {
    show(
      tree(el('x-youtube', { dataId: 'dQw4w9WgXcQ', dataStart: '42', dataCaption: 'Um clássico' })),
    );

    expect(
      screen.getByRole('button', { name: /Reproduzir vídeo: Um clássico/ }),
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
    expect(document.querySelector('iframe')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Reproduzir vídeo/ }));
    const iframe = document.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*start=42/,
    );
  });

  it('<x-callout> vira destaque com título; tipo desconhecido cai em "info"', () => {
    show(
      tree(
        el('x-callout', { dataType: 'warning', dataTitle: 'Atenção' }, [
          el('p', {}, [text('Cuidado.')]),
        ]),
        el('x-callout', { dataType: 'inventado' }, [el('p', {}, [text('Nota.')])]),
      ),
    );

    expect(screen.getByText('Atenção')).toBeInTheDocument();
    expect(screen.getByText('Cuidado.').closest('.my-6')).toHaveClass('border-yellow-600');
    expect(screen.getByText('Nota.').closest('.my-6')).toHaveClass('border-link');
  });

  it('tabelas ganham o contêiner com rolagem horizontal', () => {
    show(tree(el('table', {}, [el('tbody', {}, [el('tr', {}, [el('td', {}, [text('1')])])])])));
    expect(document.querySelector('.md-table > table')).not.toBeNull();
  });

  it('blocos de código ganham o botão de copiar', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    show(tree(el('pre', {}, [el('code', {}, [text('const x = 1;')])])));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('const x = 1;'));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('o resto do HTML passa direto (figuras, vídeos, links)', () => {
    show(
      tree(
        el('figure', { className: ['md-figure'] }, [
          el('video', {
            src: '/uploads/demo.mp4',
            controls: true,
            playsInline: true,
            preload: 'metadata',
          }),
          el('figcaption', {}, [text('Demonstração')]),
        ]),
      ),
    );
    const video = document.querySelector('figure.md-figure video');
    expect(video).toHaveAttribute('src', '/uploads/demo.mp4');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(screen.getByText('Demonstração').tagName).toBe('FIGCAPTION');
  });
});
