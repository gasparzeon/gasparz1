/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';

import { DEFAULT_SITE_SETTINGS } from '@/lib/site/schema';

import { Header } from '../header';

let mockPathname = '/';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const nav = () => screen.getByRole('navigation', { name: 'Principal' });

describe('<Header /> — onde estou', () => {
  it('num post, "Arquivo" marca a seção (aria-current="true"), não a página', () => {
    mockPathname = '/posts/h4ck34ndo-as-urnas';
    render(<Header navigation={DEFAULT_SITE_SETTINGS.navigation} />);
    expect(within(nav()).getByRole('link', { name: 'Arquivo' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('no arquivo, "Arquivo" é a página atual', () => {
    mockPathname = '/posts';
    render(<Header navigation={DEFAULT_SITE_SETTINGS.navigation} />);
    expect(within(nav()).getByRole('link', { name: 'Arquivo' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('numa página de autor, "Creators" marca a seção', () => {
    mockPathname = '/creators';
    render(<Header navigation={DEFAULT_SITE_SETTINGS.navigation} />);
    expect(within(nav()).getByRole('link', { name: 'Creators' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('âncoras (Seções) e o início nunca ficam marcados por engano', () => {
    mockPathname = '/';
    render(<Header navigation={DEFAULT_SITE_SETTINGS.navigation} />);
    within(nav())
      .getAllByRole('link')
      .forEach((link) => expect(link).not.toHaveAttribute('aria-current'));
  });
});
