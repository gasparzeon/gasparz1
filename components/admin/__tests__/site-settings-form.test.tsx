/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import { ApiError, adminFetch } from '@/lib/admin/client';
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '@/lib/site/schema';

import { SiteSettingsForm } from '../site/site-settings-form';

jest.mock('@/lib/admin/client', () => ({
  ...jest.requireActual('@/lib/admin/client'),
  adminFetch: jest.fn(),
}));
jest.mock('@/lib/admin/upload', () => ({ uploadMedia: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockRouter = { refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));

const mockFetch = adminFetch as jest.Mock;
const copy = (): SiteSettings => JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS));

function setup(updatedAt: string | null = null) {
  render(<SiteSettingsForm initial={copy()} updatedAt={updatedAt} mediaMode="local" />);
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const tab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
const saveButton = () => screen.getByRole('button', { name: /Salvar alterações/ });
const sentSettings = () => JSON.parse(String(mockFetch.mock.calls.at(-1)[1].body));

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (_url: string, init: RequestInit) => ({
    settings: JSON.parse(String(init.body)).settings,
    updatedAt: '2026-10-13T12:00:00.000Z',
  }));
});

describe('<SiteSettingsForm />', () => {
  it('salva o que mudou com a versão carregada e volta para "Tudo salvo"', async () => {
    setup('2026-10-13T10:00:00.000Z');
    expect(screen.getByText('Tudo salvo')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    type('Nome do site', 'Gaspar Labs 2');
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText('Tudo salvo')).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/site',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(sentSettings()).toMatchObject({
      expectedUpdatedAt: '2026-10-13T10:00:00.000Z',
      settings: { general: { name: 'Gaspar Labs 2' } },
    });
    expect(toast.success).toHaveBeenCalledWith('Site atualizado.', expect.anything());
  });

  it('valida antes de enviar e diz em que aba está o problema', () => {
    setup();
    type('Nome do site', '');
    fireEvent.click(saveButton());
    expect(toast.error).toHaveBeenCalledWith('Geral: Informe o nome do site.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('edita o menu: adiciona, reordena e remove links', async () => {
    setup();
    tab('Menu');

    fireEvent.click(screen.getByRole('button', { name: /Adicionar link/ }));
    const rows = () =>
      screen.getAllByLabelText('Texto').map((input) => (input as HTMLInputElement).value);
    expect(rows()).toEqual(['Gaspar Labs', 'Arquivo', 'Seções', 'Sobre', 'Novo link']);

    fireEvent.click(screen.getByRole('button', { name: 'Descer Arquivo' }));
    expect(rows()).toEqual(['Gaspar Labs', 'Seções', 'Arquivo', 'Sobre', 'Novo link']);

    fireEvent.click(screen.getByRole('button', { name: 'Remover Novo link' }));
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(sentSettings().settings.navigation.links).toEqual([
      { label: 'Seções', href: '/#secoes' },
      { label: 'Arquivo', href: '/posts' },
      { label: 'Sobre', href: '/about' },
    ]);
  });

  it('a aba Creators pode ser desligada e vai junto ao salvar', async () => {
    setup();
    tab('Menu');
    const toggle = screen.getByRole('switch', { name: 'Aba Creators' });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    fireEvent.click(saveButton());
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(sentSettings()).toMatchObject({ settings: { navigation: { showCreators: false } } });
  });

  it('link perigoso no menu não é enviado', () => {
    setup();
    tab('Menu');
    const linkInputs = screen.getAllByLabelText('Link');
    fireEvent.change(linkInputs[0], { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(saveButton());
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/^Menu: Link inválido/));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('desligar os comentários esconde o título e vai junto ao salvar', async () => {
    setup();
    tab('Integrações');
    expect(screen.getByLabelText('Título da seção')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Comentários nos posts' }));
    expect(screen.queryByLabelText('Título da seção')).not.toBeInTheDocument();

    fireEvent.click(saveButton());
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(sentSettings().settings.integrations.comments).toEqual({
      enabled: false,
      title: 'Comentários',
    });
  });

  it('conflito: avisa e oferece recarregar', async () => {
    mockFetch.mockRejectedValue(new ApiError('Outra pessoa salvou.', 409, { error: 'conflict' }));
    setup();
    type('Nome do site', 'X');
    fireEvent.click(saveButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [message, options] = (toast.error as jest.Mock).mock.calls[0];
    expect(message).toBe('Outra pessoa salvou.');
    options.action.onClick();
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it('"Descartar" volta ao que estava salvo', () => {
    setup();
    type('Nome do site', 'Rascunho');
    fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));
    expect(field('Nome do site').value).toBe('Gaspar Labs');
    expect(screen.getByText('Tudo salvo')).toBeInTheDocument();
  });

  it('a imagem de compartilhamento pode vir da janela de mídia', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Escolher' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'URL' }), { button: 0 });
    fireEvent.change(within(dialog).getByLabelText('URL da imagem'), {
      target: { value: '/uploads/2026/10/og.png' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usar' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usar como capa' }));
    await waitFor(() =>
      expect(field('Imagem de compartilhamento').value).toBe('/uploads/2026/10/og.png'),
    );
  });
});
