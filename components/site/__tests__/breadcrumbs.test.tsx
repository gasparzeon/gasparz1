/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';

import { Breadcrumbs } from '../breadcrumbs';

jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

describe('<Breadcrumbs />', () => {
  it('Início › seção › página atual (sem link e com aria-current)', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Investigações', href: '/posts?secao=investigacoes' },
          { label: 'H4CK34NDO AS URNAS!' },
        ]}
      />,
    );
    const trail = screen.getByRole('navigation', { name: 'Você está em' });
    const items = within(trail).getAllByRole('listitem');
    expect(items).toHaveLength(3);

    expect(within(trail).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
    expect(within(trail).getByRole('link', { name: 'Investigações' })).toHaveAttribute(
      'href',
      '/posts?secao=investigacoes',
    );
    const current = within(trail).getByText('H4CK34NDO AS URNAS!');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.closest('a')).toBeNull();
  });

  it('o último item nunca é link, mesmo que venha com endereço', () => {
    render(<Breadcrumbs items={[{ label: 'Creators', href: '/creators' }]} />);
    expect(screen.queryByRole('link', { name: 'Creators' })).not.toBeInTheDocument();
    expect(screen.getByText('Creators')).toHaveAttribute('aria-current', 'page');
  });

  it('separadores são decorativos', () => {
    const { container } = render(<Breadcrumbs items={[{ label: 'Arquivo' }]} />);
    container.querySelectorAll('li > span:first-child').forEach((separator) => {
      if (separator.textContent === '›') expect(separator).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
