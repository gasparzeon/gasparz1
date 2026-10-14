/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { YouTube } from '../youtube';

describe('<YouTube />', () => {
  it('mostra só a miniatura até o leitor clicar (sem iframe do YouTube)', () => {
    const { container } = render(<YouTube id="dQw4w9WgXcQ" caption="Um clássico" />);

    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
    expect(screen.getByText('Um clássico').tagName).toBe('FIGCAPTION');
  });

  it('carrega o player sem cookies no clique, respeitando o início', () => {
    const { container } = render(<YouTube url="https://youtu.be/dQw4w9WgXcQ?t=42" title="Clipe" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir vídeo: Clipe' }));

    const iframe = container.querySelector('iframe')!;
    const src = new URL(iframe.getAttribute('src')!);
    expect(src.origin + src.pathname).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(src.searchParams.get('autoplay')).toBe('1');
    expect(src.searchParams.get('start')).toBe('42');
    expect(iframe).toHaveAttribute('title', 'Clipe');
  });

  it('a prop start tem prioridade sobre o tempo do link', () => {
    const { container } = render(<YouTube url="https://youtu.be/dQw4w9WgXcQ?t=42" start="7" />);
    fireEvent.click(screen.getByRole('button'));
    expect(container.querySelector('iframe')!.getAttribute('src')).toContain('start=7');
  });

  it('não renderiza nada com ID inválido', () => {
    const { container } = render(<YouTube id={'x" onerror="alert(1)'} />);
    expect(container).toBeEmptyDOMElement();
  });
});
