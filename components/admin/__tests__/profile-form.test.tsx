/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import { adminFetch } from '@/lib/admin/client';

import { ProfileForm } from '../profile-form';

jest.mock('@/lib/admin/client', () => ({ adminFetch: jest.fn(), redirectToLogin: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockRouter = { refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
// A janela de mídia tem testes próprios; aqui só atrapalharia.
jest.mock('../media-dialog', () => ({ MediaDialog: () => null }));

const mockFetch = adminFetch as jest.Mock;

const PROFILE = {
  name: 'Gaspar',
  username: 'gaspar',
  email: 'gaspar@example.com',
  bio: 'Pesquisa.',
  avatarUrl: '',
  role: 'owner' as const,
  readme: '',
  socials: [
    { network: 'x' as const, handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' },
  ],
};

const setup = () => render(<ProfileForm profile={PROFILE} mediaMode="local" />);
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const sent = () => JSON.parse(String(mockFetch.mock.calls.at(-1)[1].body));

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({});
});

describe('<ProfileForm /> — redes sociais', () => {
  it('uma linha por rede, com as salvas já preenchidas', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Redes sociais' });
    ['Spotify', 'X (Twitter)', 'Facebook', 'TikTok', 'Instagram'].forEach((network) => {
      expect(within(group).getByLabelText(network)).toBeInTheDocument();
      expect(
        within(group).getByLabelText(`Nome exibido no ${network} (opcional)`),
      ).toBeInTheDocument();
    });
    expect(field('X (Twitter)').value).toBe('https://x.com/gasparzeon');
    expect(field('Instagram').value).toBe('');
  });

  it('prévia mostra como fica no site, só com as redes válidas', () => {
    setup();
    fireEvent.change(field('Instagram'), { target: { value: '@gaspar.labs' } });
    fireEvent.change(field('Nome exibido no Instagram (opcional)'), {
      target: { value: 'Gaspar Labs' },
    });

    const preview = screen.getByRole('list', { name: 'Redes de Gaspar' });
    expect(within(preview).getByRole('link', { name: /Gaspar Labs Instagram/ })).toHaveAttribute(
      'href',
      'https://www.instagram.com/gaspar.labs/',
    );
    expect(within(preview).getByRole('link', { name: /@gasparzeon/ })).toBeInTheDocument();
  });

  it('link errado: erro ligado ao campo depois que a pessoa sai dele', () => {
    setup();
    const tiktok = field('TikTok');
    fireEvent.change(tiktok, { target: { value: 'https://evil.com/@gaspar' } });
    expect(tiktok).not.toHaveAttribute('aria-invalid');

    fireEvent.blur(tiktok);
    expect(tiktok).toHaveAttribute('aria-invalid', 'true');
    expect(tiktok).toHaveAccessibleDescription('Esse link não é do TikTok.');
  });

  it('salvar com link errado: não envia, foca o campo e avisa', () => {
    setup();
    fireEvent.change(field('Facebook'), { target: { value: 'facebook.com/sharer.php' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(field('Facebook')).toHaveFocus();
    expect(field('Facebook')).toHaveAttribute('aria-invalid', 'true');
    expect(toast.error).toHaveBeenCalledWith('Confira o link das redes sociais.');
  });

  it('salva o perfil junto com as redes (uma linha por rede, vazias incluídas)', async () => {
    setup();
    fireEvent.change(field('Spotify'), { target: { value: 'open.spotify.com/user/gasparzeon' } });
    fireEvent.change(field('X (Twitter)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Perfil atualizado.'));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/me',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(sent()).toMatchObject({
      name: 'Gaspar',
      username: 'gaspar',
      socials: [
        { network: 'spotify', value: 'open.spotify.com/user/gasparzeon', label: '' },
        { network: 'x', value: '', label: '' },
        { network: 'facebook', value: '', label: '' },
        { network: 'tiktok', value: '', label: '' },
        { network: 'instagram', value: '', label: '' },
      ],
    });
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it('README vai junto ao salvar', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('README em Markdown'), {
      target: { value: '### Sobre mim\nPesquiso urnas.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Perfil atualizado.'));
    expect(sent()).toMatchObject({ readme: '### Sobre mim\nPesquiso urnas.' });
  });

  it('README com linhas demais: não envia, foca o campo e diz o problema', () => {
    setup();
    const readme = screen.getByLabelText('README em Markdown');
    fireEvent.change(readme, { target: { value: Array(31).fill('linha').join('\n') } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(readme).toHaveFocus();
    expect(toast.error).toHaveBeenCalledWith('Use no máximo 30 linhas (tem 31).');
  });

  it('erro do servidor aparece no aviso', async () => {
    mockFetch.mockRejectedValue(new Error('Usuário ou e-mail já em uso por outra conta.'));
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Usuário ou e-mail já em uso por outra conta.'),
    );
  });
});
