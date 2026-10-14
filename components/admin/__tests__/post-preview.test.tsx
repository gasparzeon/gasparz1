/** @jest-environment jsdom */
import { act, render, screen } from '@testing-library/react';

import { adminFetch } from '@/lib/admin/client';

import { PostPreview, readingMinutes } from '../post-preview';

jest.mock('@/lib/admin/client', () => ({ adminFetch: jest.fn() }));

const mockFetch = adminFetch as jest.Mock;

// Árvore como a API de preview devolve (o pipeline real tem testes próprios).
const TREE = {
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'figure',
      properties: { className: ['md-figure'] },
      children: [
        {
          type: 'element',
          tagName: 'img',
          properties: { src: '/uploads/a.png', alt: 'Gráfico' },
          children: [],
        },
        {
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: [{ type: 'text', value: 'Legenda' }],
        },
      ],
    },
    { type: 'element', tagName: 'x-youtube', properties: { dataId: 'dQw4w9WgXcQ' }, children: [] },
  ],
};

const base = {
  title: 'Meu post',
  content: 'Olá mundo',
  tags: ['ia', 'mac'],
  publishedAt: '2026-10-12',
  updatedAt: '',
  coverImage: '',
  author: { name: 'Ana', avatarUrl: '' },
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
}

describe('readingMinutes', () => {
  it('conta 200 palavras por minuto, com mínimo de 1', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('palavra '.repeat(400))).toBe(2);
    expect(readingMinutes('palavra '.repeat(1100))).toBe(6);
  });
});

describe('<PostPreview />', () => {
  it('mostra cabeçalho, capa e o conteúdo renderizado pelo servidor', async () => {
    mockFetch.mockResolvedValue({ tree: TREE });
    render(<PostPreview {...base} coverImage="/uploads/capa.png" updatedAt="2026-10-13" />);

    expect(screen.getByRole('heading', { name: 'Meu post' })).toBeInTheDocument();
    expect(screen.getByText('ia')).toBeInTheDocument();
    expect(screen.getByText('1 min de leitura')).toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/)).toBeInTheDocument();
    expect(document.querySelector('img[src="/uploads/capa.png"]')).toHaveClass('aspect-[2/1]');

    await flush();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/preview',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ content: 'Olá mundo' }) }),
    );
    expect(screen.getByRole('img', { name: 'Gráfico' })).toBeInTheDocument();
    expect(screen.getByText('Legenda')).toBeInTheDocument();
    // YouTube aparece como miniatura + botão; o player só carrega no clique.
    expect(screen.getByRole('button', { name: /Reproduzir vídeo/ })).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('espera a digitação parar (400 ms) e manda só a última versão', async () => {
    mockFetch.mockResolvedValue({ tree: { type: 'root', children: [] } });
    const { rerender } = render(<PostPreview {...base} content="a" />);

    rerender(<PostPreview {...base} content="ab" />);
    rerender(<PostPreview {...base} content="abc" />);
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ content: 'abc' }));
  });

  it('avisa quando a pré-visualização falha', async () => {
    mockFetch.mockRejectedValue(new Error('Sessão expirada.'));
    render(<PostPreview {...base} title="" publishedAt="" />);

    expect(screen.getByRole('heading', { name: 'Sem título' })).toBeInTheDocument();
    expect(screen.getByText('Sem data')).toBeInTheDocument();
    await flush();
    expect(
      screen.getByText(/Não foi possível atualizar a pré-visualização: Sessão expirada./),
    ).toBeInTheDocument();
  });
});
