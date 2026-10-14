/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { NoPermission } from '../no-permission';

jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

describe('<NoPermission />', () => {
  it('explica e oferece os dois caminhos: painel e site', () => {
    render(<NoPermission message="Só editores moderam comentários." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.getByText('Só editores moderam comentários.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao painel' })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(screen.getByRole('link', { name: 'Voltar ao site' })).toHaveAttribute('href', '/');
  });
});
