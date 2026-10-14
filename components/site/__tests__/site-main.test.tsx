/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { SiteMain } from '../site-main';

let mockPathname = '/';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));

describe('<SiteMain />', () => {
  it('no site: área principal com o alvo do "Pular para o conteúdo"', () => {
    mockPathname = '/posts';
    render(<SiteMain>conteúdo</SiteMain>);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'conteudo');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(main).toHaveTextContent('conteúdo');
  });

  it('no painel: sem <main> aqui (cada tela do painel tem o seu, sem área dentro de área)', () => {
    mockPathname = '/admin/perfil';
    render(<SiteMain>painel</SiteMain>);
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('painel')).toBeInTheDocument();
  });
});
