/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { requireAdminPage } from '@/lib/auth/session';
import { getMediaMode } from '@/lib/cms/media';
import { getProfile } from '@/lib/users/service';
import { ProfileForm } from '@/components/admin/profile-form';

import ProfilePage from '../page';

// Página servidora: sessão, serviço e formulário mockados.
jest.mock('@/lib/auth/session', () => ({ requireAdminPage: jest.fn() }));
jest.mock('@/lib/users/service', () => ({ getProfile: jest.fn() }));
jest.mock('@/lib/cms/media', () => ({ getMediaMode: jest.fn(() => 'local') }));
jest.mock('@/components/admin/profile-form', () => ({ ProfileForm: jest.fn(() => null) }));
jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const PROFILE = {
  id: 'u1',
  name: 'Gaspar',
  username: 'gaspar',
  email: null,
  bio: '',
  avatarUrl: '',
  role: 'owner' as const,
  socials: [
    { network: 'x' as const, handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' },
  ],
  readme: '### Sobre mim\nPesquiso urnas.',
};

beforeEach(() => {
  jest.mocked(requireAdminPage).mockResolvedValue({
    user: { id: 'u1', username: 'gaspar', name: 'Gaspar', role: 'owner', avatarUrl: '' },
  } as Awaited<ReturnType<typeof requireAdminPage>>);
  jest.mocked(getProfile).mockResolvedValue(PROFILE);
});

describe('/admin/perfil', () => {
  it('exige login (volta para /admin/perfil) e lê o perfil de quem entrou', async () => {
    render(await ProfilePage());
    expect(requireAdminPage).toHaveBeenCalledWith('/admin/perfil');
    expect(getProfile).toHaveBeenCalledWith('u1');
    expect(screen.getByRole('heading', { level: 1, name: 'Meu perfil' })).toBeInTheDocument();
  });

  it('o formulário recebe as redes e o README salvos, e o modo de mídia', async () => {
    render(await ProfilePage());
    const props = jest.mocked(ProfileForm).mock.calls[0][0];
    expect(props.profile).toMatchObject({
      readme: '### Sobre mim\nPesquiso urnas.',
      socials: [{ network: 'x', url: 'https://x.com/gasparzeon' }],
    });
    expect(props.mediaMode).toBe('local');
    expect(getMediaMode).toHaveBeenCalled();
  });

  it('perfil que sumiu (conta apagada no meio da sessão) → 404', async () => {
    jest.mocked(getProfile).mockResolvedValue(null);
    await expect(ProfilePage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(ProfileForm).not.toHaveBeenCalled();
  });
});
