/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import { ApiError, adminFetch } from '@/lib/admin/client';
import { imageMarkdown } from '@/lib/admin/markdown';
import type { Role } from '@/lib/auth/permissions';
import type { PostDocument } from '@/lib/cms/schema';

import { PostEditor } from '../post-editor';

// Editor inteiro com os componentes reais (texto, configurações, mídia,
// pré-visualização); só a API, o roteador e os toasts são mocks.
jest.mock('@/lib/admin/client', () => ({
  ...jest.requireActual('@/lib/admin/client'),
  adminFetch: jest.fn(),
}));
jest.mock('@/lib/admin/upload', () => ({ uploadMedia: jest.fn(), validateFile: jest.fn() }));
jest.mock('@/lib/admin/github-ref', () => ({ resolveRef: jest.fn() }));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), loading: jest.fn() },
}));
const mockRouter = { push: jest.fn(), refresh: jest.fn() };
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

const viewer = (role: Role = 'author') => ({ id: 'u1', name: 'Ana', role, avatarUrl: '' });

function postDocument(overrides: Partial<PostDocument> = {}): PostDocument {
  return {
    id: 'p1',
    slug: 'meu-post',
    title: 'Meu post',
    excerpt: 'Resumo.',
    content: 'Texto inicial.',
    publishedAt: '2026-10-12',
    updatedAt: '',
    tags: [],
    section: '',
    coverImage: '',
    status: 'draft',
    version: 3,
    author: { id: 'u1', name: 'Ana', username: 'ana', avatarUrl: '' },
    modifiedAt: '2026-10-12T10:00:00Z',
    ...overrides,
  };
}

// Responde como a API: devolve o post salvo com a versão seguinte.
function respondWithSaved(overrides: Partial<PostDocument> = {}) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/preview') return { tree: { type: 'root', children: [] } };
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (!body) return { post: postDocument(overrides) };
    return {
      post: postDocument({
        ...body.post,
        id: 'p1',
        status: body.status,
        version: (body.expectedVersion ?? 0) + 1,
        author: { id: body.post.authorId, name: 'Ana', username: 'ana', avatarUrl: '' },
        ...overrides,
      }),
    };
  });
}

function setup({
  initial = null as PostDocument | null,
  role = 'author' as Role,
  authors = [] as { id: string; name: string; username: string }[],
} = {}) {
  return render(
    <PostEditor
      initial={initial}
      viewer={viewer(role)}
      authors={authors}
      mediaMode="local"
      tagSuggestions={[]}
    />,
  );
}

// Pelo papel: "Título" também é o nome do botão de seção da barra de formatação.
const field = (label: string) =>
  screen.getByRole('textbox', { name: label }) as HTMLTextAreaElement;
const content = () => field('Conteúdo do post em Markdown');
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const sentBody = (call = 0) => JSON.parse(String(mockFetch.mock.calls[call][1].body));
const saveCalls = () => mockFetch.mock.calls.filter(([url]) => url !== '/api/admin/preview');

beforeEach(() => {
  window.localStorage.clear();
  document.execCommand = jest.fn(() => false);
  mockFetch.mockReset();
  respondWithSaved();
});

describe('post novo', () => {
  it('o slug acompanha o título e o post é criado ao publicar', async () => {
    const replaceState = jest.spyOn(window.history, 'replaceState');
    setup();
    expect(screen.getByText('Novo post')).toBeInTheDocument();

    fireEvent.change(field('Título'), { target: { value: 'Olá, Mundo! Meu 1º post' } });
    fireEvent.change(field('Resumo'), { target: { value: 'Um resumo.' } });
    fireEvent.change(content(), { target: { value: 'Primeiro parágrafo.' } });
    expect(screen.getByText('Não salvo')).toBeInTheDocument();

    fireEvent.click(button('Publicar'));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Post publicado', expect.anything()),
    );
    const [url, init] = saveCalls()[0];
    expect(url).toBe('/api/admin/posts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({
      status: 'published',
      expectedVersion: null,
      post: {
        title: 'Olá, Mundo! Meu 1º post',
        slug: 'ola-mundo-meu-1-post',
        excerpt: 'Um resumo.',
        content: 'Primeiro parágrafo.',
        authorId: 'u1',
      },
    });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/admin/posts/p1');
    expect(screen.getByText(/^Salvo às/)).toBeInTheDocument();
  });

  it('não salva sem título', () => {
    setup();
    fireEvent.click(button('Salvar'));
    expect(toast.error).toHaveBeenCalledWith('Dê um título ao post antes de salvar.');
    expect(saveCalls()).toHaveLength(0);
  });

  it('Ctrl+S salva de qualquer lugar da página', async () => {
    setup({ initial: postDocument() });
    fireEvent.change(content(), { target: { value: 'Mudei.' } });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveCalls()).toHaveLength(1));
    expect(saveCalls()[0][0]).toBe('/api/admin/posts/p1');
  });

  it('o rodapé conta palavras e tempo de leitura', () => {
    setup();
    fireEvent.change(content(), { target: { value: 'palavra '.repeat(450) } });
    expect(screen.getByText('450 palavras')).toBeInTheDocument();
    expect(screen.getByText('2 min de leitura')).toBeInTheDocument();
  });
});

describe('botões conforme o papel', () => {
  it('colaborador envia para revisão e depois vê o aviso de revisão', async () => {
    setup({ role: 'contributor', initial: postDocument() });
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();

    fireEvent.click(button('Enviar para revisão'));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Enviado para revisão', expect.anything()),
    );
    expect(sentBody()).toMatchObject({ status: 'review', expectedVersion: 3 });
    expect(screen.getByText(/Este post está em revisão/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar para revisão' })).not.toBeInTheDocument();
  });

  it('editor vê "Aprovar e publicar" num post em revisão e pode trocar o autor', () => {
    setup({
      role: 'editor',
      initial: postDocument({ status: 'review' }),
      authors: [
        { id: 'u1', name: 'Ana', username: 'ana' },
        { id: 'u2', name: 'Bia', username: 'bia' },
      ],
    });
    expect(button('Aprovar e publicar')).toBeInTheDocument();
    fireEvent.click(button('Configurações do post'));
    expect(screen.getByLabelText('Autor do post')).toBeInTheDocument();
  });

  it('post publicado: "Atualizar" só libera depois de alguma mudança', async () => {
    setup({ initial: postDocument({ status: 'published' }) });
    expect(button('Atualizar')).toBeDisabled();

    fireEvent.change(content(), { target: { value: 'Correção.' } });
    expect(button('Atualizar')).toBeEnabled();
    fireEvent.click(button('Atualizar'));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Alterações salvas', expect.anything()),
    );
    expect(saveCalls()[0][1].method).toBe('PUT');
    expect(sentBody()).toMatchObject({ status: 'published', expectedVersion: 3 });
    expect(button('Atualizar')).toBeDisabled();
  });
});

describe('erros ao salvar', () => {
  it('conflito de versão: sobrescrever busca a versão atual e salva por cima', async () => {
    let attempt = 0;
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/preview') return { tree: { type: 'root', children: [] } };
      if (!init) return { post: postDocument({ version: 7 }) };
      attempt += 1;
      if (attempt === 1) throw new ApiError('Conflito', 409, { error: 'conflict' });
      const body = JSON.parse(String(init.body));
      return { post: postDocument({ ...body.post, version: body.expectedVersion + 1 }) };
    });
    setup({ initial: postDocument() });
    fireEvent.change(content(), { target: { value: 'Minha versão.' } });
    fireEvent.click(button('Salvar'));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Este post mudou em outro lugar')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sobrescrever com a minha' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Alterações salvas', expect.anything()),
    );
    const last = saveCalls().at(-1)!;
    expect(JSON.parse(String(last[1].body))).toMatchObject({
      expectedVersion: 7,
      post: { content: 'Minha versão.' },
    });
  });

  it('conflito de versão: "Carregar versão do servidor" descarta a edição local', async () => {
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/preview') return { tree: { type: 'root', children: [] } };
      if (!init) return { post: postDocument({ content: 'Versão do servidor.', version: 8 }) };
      throw new ApiError('Conflito', 409, { error: 'conflict' });
    });
    setup({ initial: postDocument() });
    fireEvent.change(content(), { target: { value: 'Minha versão.' } });
    fireEvent.click(button('Salvar'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Carregar versão do servidor' }));

    await waitFor(() => expect(content().value).toBe('Versão do servidor.'));
    expect(toast.success).toHaveBeenCalledWith('Versão do servidor carregada.');
  });

  it('slug em uso abre as configurações para escolher outra URL', async () => {
    mockFetch.mockRejectedValue(
      new ApiError('Este endereço já está em uso.', 409, { error: 'exists' }),
    );
    setup({ initial: postDocument() });
    fireEvent.change(content(), { target: { value: 'x' } });
    fireEvent.click(button('Salvar'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Este endereço já está em uso.', {
        description: 'Escolha outra URL nas configurações.',
      }),
    );
    expect(screen.getByText('Configurações do post')).toBeInTheDocument();
  });

  it('post apagado em outro lugar: avisa e salva de novo como post novo', async () => {
    mockFetch.mockRejectedValueOnce(new ApiError('Não encontrado', 404, { error: 'not_found' }));
    setup({ initial: postDocument() });
    fireEvent.change(content(), { target: { value: 'x' } });
    fireEvent.click(button('Salvar'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Este post foi removido em outro lugar.',
        expect.anything(),
      ),
    );
    respondWithSaved();
    fireEvent.click(button('Salvar'));
    await waitFor(() => expect(saveCalls().at(-1)![0]).toBe('/api/admin/posts'));
  });

  it('slug inválido não chega à API', () => {
    setup({ initial: postDocument({ slug: 'slug inválido' }) });
    fireEvent.click(button('Salvar'));
    expect(toast.error).toHaveBeenCalledWith('A URL do post é inválida.', expect.anything());
    expect(saveCalls()).toHaveLength(0);
  });
});

describe('rascunho guardado no navegador', () => {
  it('guarda as mudanças não salvas e oferece restaurar ao reabrir', async () => {
    jest.useFakeTimers();
    try {
      const { unmount } = setup({ initial: postDocument() });
      fireEvent.change(content(), { target: { value: 'Texto que não foi salvo.' } });
      act(() => {
        jest.advanceTimersByTime(900);
      });
      unmount();

      setup({ initial: postDocument() });
      expect(screen.getByText(/Há alterações não salvas/)).toBeInTheDocument();
      fireEvent.click(button('Restaurar'));
      expect(content().value).toBe('Texto que não foi salvo.');
    } finally {
      jest.useRealTimers();
    }
  });

  it('"Descartar" apaga o rascunho guardado', () => {
    window.localStorage.setItem(
      'gaspar-admin:backup:p1',
      JSON.stringify({ fields: { ...postDocument(), content: 'Antigo.' }, savedAt: Date.now() }),
    );
    setup({ initial: postDocument() });
    fireEvent.click(button('Descartar'));
    expect(window.localStorage.getItem('gaspar-admin:backup:p1')).toBeNull();
    expect(content().value).toBe('Texto inicial.');
  });

  it('avisa antes de sair da página com mudanças não salvas', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    setup({ initial: postDocument() });

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fireEvent.change(content(), { target: { value: 'Mudança.' } });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);

    const leave = fireEvent.click(screen.getByRole('link', { name: 'Voltar aos Posts' }));
    expect(confirm).toHaveBeenCalledWith('Há alterações não salvas. Sair mesmo assim?');
    expect(leave).toBe(false); // navegação cancelada
  });
});

describe('mídia, capa e visualização', () => {
  it('imagem escolhida na janela de mídia entra no texto com texto alternativo e legenda', async () => {
    setup();
    fireEvent.click(button('Imagem'));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'URL' }), { button: 0 });
    fireEvent.change(screen.getByLabelText('URL da imagem'), {
      target: { value: 'https://exemplo.com/a.png' },
    });
    fireEvent.click(button('Usar'));
    fireEvent.change(screen.getByLabelText('Texto alternativo'), {
      target: { value: 'Um gráfico' },
    });
    fireEvent.change(screen.getByLabelText('Legenda (opcional)'), {
      target: { value: 'Fonte: teste' },
    });
    fireEvent.click(button('Inserir'));

    await waitFor(() =>
      expect(content().value).toContain(
        imageMarkdown('https://exemplo.com/a.png', 'Um gráfico', 'Fonte: teste'),
      ),
    );
  });

  it('a capa escolhida nas configurações vai junto ao salvar', async () => {
    setup({ initial: postDocument() });
    fireEvent.click(button('Configurações do post'));
    fireEvent.click(button(/Adicionar capa/));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'URL' }), { button: 0 });
    fireEvent.change(screen.getByLabelText('URL da imagem'), {
      target: { value: '/uploads/2026/10/capa.png' },
    });
    fireEvent.click(button('Usar'));
    fireEvent.click(button('Usar como capa'));

    await waitFor(() =>
      expect(document.querySelector('img[src="/uploads/2026/10/capa.png"]')).not.toBeNull(),
    );
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveCalls()).toHaveLength(1));
    expect(sentBody(mockFetch.mock.calls.indexOf(saveCalls()[0]))).toMatchObject({
      post: { coverImage: '/uploads/2026/10/capa.png' },
    });
  });

  it('"Visualizar" troca o editor pela pré-visualização e lembra a escolha', async () => {
    setup({ initial: postDocument() });
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar', pressed: false }));

    expect(screen.queryByLabelText('Conteúdo do post em Markdown')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meu post' })).toBeInTheDocument();
    expect(window.localStorage.getItem('gaspar-admin:view')).toBe('"preview"');
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/preview',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('excluir pelas configurações volta para a lista de posts', async () => {
    setup({ initial: postDocument() });
    fireEvent.click(button('Configurações do post'));
    fireEvent.click(button(/Excluir post/));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Excluir “Meu post”?')).toBeInTheDocument();
    mockFetch.mockResolvedValueOnce(undefined);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir post' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/admin'));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/posts/p1?version=3',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
