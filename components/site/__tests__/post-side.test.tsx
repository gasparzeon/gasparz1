/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { PostSide } from '../post-side';

// O jsdom não tem IntersectionObserver: guardamos o callback para simular a leitura.
let observed: IntersectionObserverCallback | null = null;
class FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    observed = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ARTICLE = `
  <article data-gz-article>
    <div class="prose">
      <h2 id="quantas">Quantas urnas<a class="heading-anchor" aria-hidden="true" href="#quantas">#</a></h2>
      <h3 id="modelos">Modelos</h3>
      <h2 id="anatomia" aria-label="Anatomia da urna">%&lt;#*{ _&gt; [0=1</h2>
      <h2 id="footnote-label" class="sr-only">Notas de rodapé</h2>
    </div>
  </article>`;

const root = document.documentElement;

beforeEach(() => {
  observed = null;
  window.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
  document.body.innerHTML = ARTICLE;
});

afterEach(() => {
  localStorage.clear();
  root.style.removeProperty('--gz-fs');
});

describe('<PostSide />', () => {
  it('monta o índice com as partes do texto, sem "#" e sem títulos invisíveis', async () => {
    render(<PostSide minutes={6} />);
    const nav = await screen.findByRole('navigation', { name: 'Neste post' });

    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#quantas',
      '#modelos',
      '#anatomia',
    ]);
    expect(links[0]).toHaveTextContent('Quantas urnas');
    expect(links[0]).not.toHaveTextContent('#');
    // Título no meio da decodificação: o índice usa o texto real (aria-label).
    expect(links[2]).toHaveTextContent('Anatomia da urna');
  });

  it('marca a parte atual e conta "parte N de M" com o tempo restante', async () => {
    render(<PostSide minutes={6} />);
    const nav = await screen.findByRole('navigation', { name: 'Neste post' });
    expect(within(nav).getByRole('button', { name: /parte 1 de 2 · 6 min restantes/ }));

    act(() => {
      observed?.(
        [
          {
            isIntersecting: true,
            target: document.getElementById('anatomia')!,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });
    expect(within(nav).getByRole('link', { name: /Anatomia da urna/ })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getByRole('button', { name: /parte 2 de 2/ })).toBeInTheDocument();
  });

  it('o índice abre e fecha no celular (aria-expanded)', async () => {
    render(<PostSide minutes={6} />);
    const toggle = await screen.findByRole('button', { name: /Neste post/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('tamanho do texto: muda a escala, marca o botão e fica salvo', () => {
    render(<PostSide minutes={6} />);
    const group = screen.getByRole('group', { name: 'Tamanho do texto' });
    const bigger = within(group).getByRole('button', { name: 'Grande' });

    fireEvent.click(bigger);
    expect(bigger).toHaveAttribute('aria-pressed', 'true');
    expect(root.style.getPropertyValue('--gz-fs')).toBe('1.12');
    expect(localStorage.getItem('gz-fs')).toBe('grande');
  });

  it('volta com o tamanho salvo da última visita', async () => {
    localStorage.setItem('gz-fs', 'maior');
    render(<PostSide minutes={6} />);
    const group = screen.getByRole('group', { name: 'Tamanho do texto' });
    expect(root.style.getPropertyValue('--gz-fs')).toBe('1.26');
    await waitFor(() =>
      expect(within(group).getByRole('button', { name: 'Maior' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('sem títulos no texto, só a ferramenta de tamanho', () => {
    document.body.innerHTML =
      '<article data-gz-article><div class="prose"><p>Oi</p></div></article>';
    render(<PostSide minutes={2} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tamanho do texto' })).toBeInTheDocument();
  });
});
