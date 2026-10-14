/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { PostItem } from '../post-item';

jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const POST = {
  slug: 'h4ck34ndo-as-urnas',
  title: 'H4CK34NDO AS URNAS!',
  excerpt: 'Como a urna é testada, do código-fonte à totalização.',
  publishedAt: '2026-10-01',
  readingTime: '12 min',
  section: 'investigacoes' as const,
  coverImage: null,
};

describe('<PostItem />', () => {
  it('o título é o link do post, num título de nível escolhido, e decodifica', () => {
    render(
      <ul>
        <PostItem post={POST} number="#014" heading="h2" />
      </ul>,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'H4CK34NDO AS URNAS!' });
    const link = screen.getByRole('link', { name: 'H4CK34NDO AS URNAS!' });
    expect(heading).toContainElement(link);
    expect(link).toHaveAttribute('href', '/posts/h4ck34ndo-as-urnas');
    expect(link).toHaveAttribute('data-gz-scramble', 'hover');
  });

  it('mostra seção, data, tempo de leitura, número do registro e resumo', () => {
    render(
      <ul>
        <PostItem post={POST} number="#014" />
      </ul>,
    );
    expect(screen.getByText('Investigação')).toBeInTheDocument();
    expect(screen.getByText(/2026/).closest('time')).toHaveAttribute('dateTime', '2026-10-01');
    expect(screen.getByText('12 min de leitura')).toBeInTheDocument();
    expect(screen.getByText('#014')).toBeInTheDocument();
    expect(screen.getByText(/Como a urna é testada/)).toBeInTheDocument();
  });

  it('miniatura é decorativa: forma da seção ou a capa, sem texto alternativo', () => {
    const { container, rerender } = render(
      <ul>
        <PostItem post={POST} />
      </ul>,
    );
    const thumb = container.querySelector('.gz-thumb');
    expect(thumb).toHaveAttribute('aria-hidden', 'true');
    expect(thumb).toHaveClass('gz-cv-investigacoes');

    rerender(
      <ul>
        <PostItem post={{ ...POST, coverImage: '/uploads/capa.webp' }} />
      </ul>,
    );
    expect(container.querySelector('.gz-thumb img')).toHaveAttribute('alt', '');
  });

  it('sem seção e com reveal desligado', () => {
    const { container } = render(
      <ul>
        <PostItem post={{ ...POST, section: null, excerpt: '' }} reveal={false} />
      </ul>,
    );
    expect(screen.queryByText('Investigação')).not.toBeInTheDocument();
    expect(container.querySelector('li')).not.toHaveAttribute('data-gz-reveal');
    expect(container.querySelector('.gz-item-ex')).not.toBeInTheDocument();
  });
});
