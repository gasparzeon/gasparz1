/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import { ApiError, adminFetch } from '@/lib/admin/client';
import { imageMarkdown } from '@/lib/admin/markdown';
import { DEFAULT_PAGES } from '@/lib/site/default-pages';
import type { PageDocument } from '@/lib/site/pages-schema';
import { DEFAULT_SITE_SETTINGS } from '@/lib/site/schema';

import { PageEditor } from '../pages/page-editor';

jest.mock('@/lib/admin/client', () => ({
  ...jest.requireActual('@/lib/admin/client'),
  adminFetch: jest.fn(),
}));
jest.mock('@/lib/admin/upload', () => ({ uploadMedia: jest.fn(), validateFile: jest.fn() }));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), loading: jest.fn() },
}));
const mockRouter = { refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('next/link', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const mockFetch = adminFetch as jest.Mock;
const ID = '0b5ef6a2-5f3c-4c47-9c39-1a2b3c4d5e6f';

const published = (): PageDocument => ({
  ...JSON.parse(JSON.stringify(DEFAULT_PAGES[1])),
  id: ID,
  status: 'published',
  version: 3,
  updatedAt: '2026-10-12T00:00:00.000Z',
  updatedBy: { id: 'a1', name: 'Ana' },
});

// Responde como a API: devolve a página salva com a versão seguinte.
function respondWithSaved() {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/preview') {
      const { content } = JSON.parse(String(init?.body));
      return {
        tree: {
          type: 'root',
          children: [
            {
              type: 'element',
              tagName: 'p',
              properties: {},
              children: [{ type: 'text', value: content }],
            },
          ],
        },
      };
    }
    const body = JSON.parse(String(init?.body));
    return {
      page: {
        ...body.page,
        id: ID,
        status: body.status,
        version: (body.expectedVersion ?? 0) + 1,
        updatedAt: '2026-10-13T00:00:00.000Z',
        updatedBy: null,
      },
    };
  });
}

const setup = (initial: PageDocument | null = null) =>
  render(<PageEditor initial={initial} social={DEFAULT_SITE_SETTINGS.social} mediaMode="local" />);

// Campos do grupo "Página" ("Título" também é um botão da barra do Markdown).
const field = (label: string) =>
  within(screen.getByRole('region', { name: 'Página' })).getByLabelText(label) as HTMLInputElement;
const blocks = () =>
  screen
    .getAllByRole('region')
    .map((region) => region.getAttribute('aria-label') ?? '')
    .filter((label) => label.startsWith('Bloco'));
const saveCalls = () => mockFetch.mock.calls.filter(([url]) => url !== '/api/admin/preview');
const sentBody = () => JSON.parse(String(saveCalls().at(-1)![1].body));

beforeEach(() => {
  mockFetch.mockReset();
  respondWithSaved();
  document.execCommand = jest.fn(() => false);
});

describe('página nova', () => {
  it('começa com um bloco de texto e o endereço acompanha o título', () => {
    setup();
    expect(blocks()).toEqual(['Bloco 1: Texto']);
    fireEvent.change(field('Título'), { target: { value: 'Política de Privacidade' } });
    expect(field('Endereço').value).toBe('politica-de-privacidade');

    fireEvent.change(field('Endereço'), { target: { value: 'Privacidade Total' } });
    fireEvent.change(field('Título'), { target: { value: 'Outro título' } });
    expect(field('Endereço').value).toBe('privacidade-total');
  });

  it('adiciona, reordena e remove blocos', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Abertura/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cartões/ }));
    expect(blocks()).toEqual(['Bloco 1: Texto', 'Bloco 2: Abertura', 'Bloco 3: Cartões']);

    fireEvent.click(screen.getByRole('button', { name: 'Subir bloco Abertura' }));
    expect(blocks()).toEqual(['Bloco 1: Abertura', 'Bloco 2: Texto', 'Bloco 3: Cartões']);

    fireEvent.click(screen.getByRole('button', { name: 'Remover bloco Texto' }));
    expect(blocks()).toEqual(['Bloco 1: Abertura', 'Bloco 2: Cartões']);
  });

  it('salva como rascunho e troca a URL para a da página criada', async () => {
    const replaceState = jest.spyOn(window.history, 'replaceState');
    setup();
    fireEvent.change(field('Título'), { target: { value: 'Contato' } });
    fireEvent.change(screen.getByLabelText('Conteúdo do post em Markdown'), {
      target: { value: 'Fale comigo.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar rascunho/ }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Página salva', undefined));
    expect(saveCalls()[0][0]).toBe('/api/admin/pages');
    expect(sentBody()).toMatchObject({
      status: 'draft',
      expectedVersion: null,
      page: {
        slug: 'contato',
        title: 'Contato',
        blocks: [{ type: 'markdown', content: 'Fale comigo.' }],
      },
    });
    expect(replaceState).toHaveBeenCalledWith(null, '', `/admin/paginas/${ID}`);
  });

  it('não envia endereço reservado pelo sistema', () => {
    setup();
    fireEvent.change(field('Título'), { target: { value: 'Admin' } });
    fireEvent.click(screen.getByRole('button', { name: /Publicar/ }));
    expect(toast.error).toHaveBeenCalledWith('Esse endereço é usado pelo sistema.');
    expect(saveCalls()).toHaveLength(0);
  });
});

describe('página publicada', () => {
  it('"Atualizar" só libera depois de mudar algo e envia a versão carregada', async () => {
    setup(published());
    expect(screen.getByRole('button', { name: /Atualizar/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Ver no site/ })).toHaveAttribute('href', '/support');

    const hero = screen.getByRole('region', { name: 'Bloco 1: Abertura' });
    fireEvent.change(within(hero).getByLabelText('Título'), {
      target: { value: 'Apoie o projeto.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    await waitFor(() => expect(saveCalls()).toHaveLength(1));
    expect(saveCalls()[0][0]).toBe(`/api/admin/pages/${ID}`);
    expect(sentBody()).toMatchObject({ status: 'published', expectedVersion: 3 });
    expect(sentBody().page.blocks[0]).toMatchObject({ type: 'hero', title: 'Apoie o projeto.' });
    expect(sentBody().page.blocks).toHaveLength(4);
    await waitFor(() => expect(screen.getByRole('button', { name: /Atualizar/ })).toBeDisabled());
  });

  it('"Despublicar" volta para rascunho', async () => {
    setup(published());
    fireEvent.click(screen.getByRole('button', { name: 'Despublicar' }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Página voltou para rascunho', undefined),
    );
    expect(sentBody().status).toBe('draft');
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('conflito de versão avisa e oferece recarregar', async () => {
    mockFetch.mockRejectedValue(new ApiError('Alguém salvou antes.', 409, { error: 'conflict' }));
    setup(published());
    fireEvent.click(screen.getByRole('button', { name: 'Despublicar' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [message, options] = (toast.error as jest.Mock).mock.calls[0];
    expect(message).toBe('Alguém salvou antes.');
    options.action.onClick();
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});

describe('pré-visualização e mídia', () => {
  it('mostra a página como no site, com o Markdown renderizado pelo servidor', async () => {
    setup(published());
    fireEvent.click(screen.getByRole('button', { name: /Visualizar/ }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Sustente pesquisa independente.',
    );
    expect(screen.getByRole('heading', { name: 'Independência editorial' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/A internet moderna vive um paradoxo/)).toBeInTheDocument(),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/preview',
      expect.objectContaining({ method: 'POST' }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    expect(field('Título')).toBeInTheDocument();
  });

  it('imagem escolhida na janela de mídia entra no bloco de texto certo', async () => {
    setup();
    const block = screen.getByRole('region', { name: 'Bloco 1: Texto' });
    fireEvent.click(within(block).getByRole('button', { name: 'Imagem' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'URL' }), { button: 0 });
    fireEvent.change(within(dialog).getByLabelText('URL da imagem'), {
      target: { value: 'https://exemplo.com/a.png' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usar' }));
    fireEvent.change(within(dialog).getByLabelText('Texto alternativo'), {
      target: { value: 'Foto' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Inserir' }));

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Conteúdo do post em Markdown') as HTMLTextAreaElement).value,
      ).toContain(imageMarkdown('https://exemplo.com/a.png', 'Foto')),
    );
  });
});
