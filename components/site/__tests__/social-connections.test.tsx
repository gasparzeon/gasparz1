/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';

import type { ProfileSocial } from '@/lib/users/socials';

import { SocialConnections } from '../social-connections';

const SOCIALS: ProfileSocial[] = [
  {
    network: 'spotify',
    handle: '',
    url: 'https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF',
    label: '',
  },
  { network: 'x', handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' },
  {
    network: 'instagram',
    handle: 'gaspar.labs',
    url: 'https://www.instagram.com/gaspar.labs/',
    label: 'Gaspar Labs',
  },
];

describe('<SocialConnections />', () => {
  it('uma linha por rede: ícone, nome da conta, rede e link que abre em nova aba', () => {
    render(<SocialConnections socials={SOCIALS} owner="Gaspar" />);
    const list = screen.getByRole('list', { name: 'Redes de Gaspar' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(3);

    const x = within(list).getByRole('link', { name: /@gasparzeon X \(Twitter\)/ });
    expect(x).toHaveAttribute('href', 'https://x.com/gasparzeon');
    expect(x).toHaveAttribute('target', '_blank');
    expect(x).toHaveAttribute('rel', 'me noopener noreferrer');
    expect(x).toHaveAccessibleName('@gasparzeon X (Twitter) (abre em nova aba)');
  });

  it('nome exibido escolhido pela pessoa e nome genérico quando o link não tem usuário', () => {
    render(<SocialConnections socials={SOCIALS} owner="Gaspar" />);
    expect(screen.getByRole('link', { name: /Gaspar Labs Instagram/ })).toHaveAttribute(
      'href',
      'https://www.instagram.com/gaspar.labs/',
    );
    expect(screen.getByRole('link', { name: /Artista no Spotify Spotify/ })).toBeInTheDocument();
  });

  it('ícones são decorativos (escondidos de leitores de tela)', () => {
    const { container } = render(<SocialConnections socials={SOCIALS} owner="Gaspar" />);
    container.querySelectorAll('svg').forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('sem redes, não mostra nada; versão compacta ganha a classe própria', () => {
    const { container, rerender } = render(<SocialConnections socials={[]} owner="Gaspar" />);
    expect(container).toBeEmptyDOMElement();

    rerender(<SocialConnections socials={SOCIALS} owner="Gaspar" compact />);
    expect(screen.getByRole('list')).toHaveClass('gz-conns', 'gz-conns--compact');
  });
});
