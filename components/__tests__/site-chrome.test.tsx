/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '@/lib/site/schema';

import { Footer } from '../footer';
import { Header } from '../header';

jest.mock('next/navigation', () => ({ usePathname: () => '/about' }));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const settings = (patch: (value: SiteSettings) => void = () => {}) => {
  const value: SiteSettings = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS));
  patch(value);
  return value;
};

afterEach(() => {
  delete document.documentElement.dataset.motion;
  localStorage.clear();
});

describe('<Header />', () => {
  it('mostra o logo, os links e marca a página atual com aria-current', () => {
    render(<Header navigation={DEFAULT_SITE_SETTINGS.navigation} />);
    expect(screen.getByRole('link', { name: 'Gaspar Labs' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Sobre' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Arquivo' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buscar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alternar tema/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo',
    );
  });

  it('segue o que o admin configurou: logo com complemento, link externo e botões escondidos', () => {
    const value = settings((s) => {
      s.navigation.logo = { text: 'Gaspar', accent: 'Labs' };
      s.navigation.links = [{ label: 'GitHub', href: 'https://github.com/gasparzeon' }];
      s.navigation.showSearch = false;
      s.navigation.showThemeToggle = false;
      s.navigation.showAccountButtons = false;
    });
    render(<Header navigation={value.navigation} />);

    expect(screen.getByRole('link', { name: 'Gaspar Labs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('link', { name: 'Sobre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Buscar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alternar tema/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('aba Creators no fim do menu, no cabeçalho e no menu do celular', () => {
    render(<Header navigation={DEFAULT_SITE_SETTINGS.navigation} />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.at(-1)).toHaveTextContent('Creators');
    expect(links.at(-1)).toHaveAttribute('href', '/creators');

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(dialog).getByRole('link', { name: 'Creators' })).toHaveAttribute(
      'href',
      '/creators',
    );
  });

  it('aba Creators desligada no painel não aparece', () => {
    const value = settings((s) => {
      s.navigation.showCreators = false;
    });
    render(<Header navigation={value.navigation} />);
    expect(screen.queryByRole('link', { name: 'Creators' })).not.toBeInTheDocument();
  });

  it('o menu abre num diálogo com páginas, seções (com contagem) e preferências', () => {
    render(
      <Header
        navigation={DEFAULT_SITE_SETTINGS.navigation}
        sectionCounts={{ investigacoes: 3, pesquisas: 1 }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(dialog).getByRole('link', { name: /Investigações/ })).toHaveAttribute(
      'href',
      '/posts?secao=investigacoes',
    );
    expect(within(dialog).getByText('3 posts')).toBeInTheDocument();
    expect(within(dialog).getByText('1 post')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Sobre/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(dialog).getByRole('group', { name: 'Tema' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('<Footer />', () => {
  it('copyright com {ano} e {site}, nota, só as redes marcadas e o link de apoio', () => {
    render(<Footer settings={DEFAULT_SITE_SETTINGS} />);
    expect(
      screen.getByText(`© ${new Date().getFullYear()} Gaspar Labs. Todos os direitos reservados.`),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sem cookies de rastreio/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'RSS' })).not.toHaveAttribute('target');
    expect(screen.queryByRole('link', { name: 'Discord' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Seja um apoiador/ })).toHaveAttribute(
      'href',
      '/support',
    );
  });

  it('rodapé também leva à aba Creators', () => {
    render(<Footer settings={DEFAULT_SITE_SETTINGS} />);
    const nav = screen.getByRole('navigation', { name: 'Navegar' });
    expect(within(nav).getByRole('link', { name: 'Creators' })).toHaveAttribute(
      'href',
      '/creators',
    );
  });

  it('esconde o que estiver vazio ou desligado', () => {
    const value = settings((s) => {
      s.footer = { copyright: '', note: '', cta: { enabled: false, label: 'X', href: '/x' } };
      s.social = [];
      s.navigation.showAccountButtons = false;
    });
    render(<Footer settings={value} />);
    expect(screen.queryByText(/Todos os direitos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sem cookies/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Seja um apoiador/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Redes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Conta' })).not.toBeInTheDocument();
  });

  it('desligar as animações marca o <html> e fica salvo no navegador', () => {
    render(<Footer settings={DEFAULT_SITE_SETTINGS} />);
    const group = screen.getByRole('group', { name: 'Animações' });
    const off = within(group).getByRole('button', { name: 'Desligadas' });

    expect(off).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(off);

    expect(document.documentElement.dataset.motion).toBe('off');
    expect(localStorage.getItem('gz-motion')).toBe('off');
    expect(off).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Ligadas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
