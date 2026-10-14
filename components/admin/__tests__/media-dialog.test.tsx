/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import { adminFetch } from '@/lib/admin/client';
import { uploadMedia } from '@/lib/admin/upload';

import { MediaDialog, type MediaDialogKind } from '../media-dialog';

jest.mock('@/lib/admin/client', () => ({ adminFetch: jest.fn() }));
jest.mock('@/lib/admin/upload', () => ({ uploadMedia: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockFetch = adminFetch as jest.Mock;
const mockUpload = uploadMedia as jest.Mock;

const LIBRARY = [
  {
    url: '/uploads/2026/10/praia-ab12.webp',
    pathname: 'uploads/2026/10/praia-ab12.webp',
    kind: 'image',
    size: 2048,
    uploadedAt: '',
    uploadedBy: null,
  },
  {
    url: '/uploads/2026/10/demo-cd34.mp4',
    pathname: 'uploads/2026/10/demo-cd34.mp4',
    kind: 'video',
    size: 4096,
    uploadedAt: '',
    uploadedBy: null,
  },
];

function open(kind: MediaDialogKind, mediaMode: 'local' | 'blob' | 'disabled' = 'local') {
  const onInsert = jest.fn();
  const onClose = jest.fn();
  render(<MediaDialog kind={kind} mediaMode={mediaMode} onClose={onClose} onInsert={onInsert} />);
  return { onInsert, onClose };
}

// As abas do Radix trocam no mousedown com o botão principal.
const tab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe('<MediaDialog /> — YouTube', () => {
  it('só libera links reconhecidos e mostra a prévia com o início', () => {
    const { onInsert } = open('youtube');
    const submit = screen.getByRole('button', { name: 'Incorporar' });
    expect(submit).toBeDisabled();

    type('Link do vídeo', 'https://vimeo.com/123');
    expect(screen.getByText('Não reconheci esse link do YouTube.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    type('Link do vídeo', 'https://youtu.be/dQw4w9WgXcQ?t=90');
    expect(screen.getByText('começa em 1:30')).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );

    type('Legenda (opcional)', 'Um clássico');
    fireEvent.click(submit);
    expect(onInsert).toHaveBeenCalledWith({
      kind: 'youtube',
      id: 'dQw4w9WgXcQ',
      start: 90,
      caption: 'Um clássico',
    });
  });
});

describe('<MediaDialog /> — imagem', () => {
  it('por URL: bloqueia esquemas perigosos e pede texto alternativo e legenda', () => {
    const { onInsert } = open('image');
    tab('URL');

    type('URL da imagem', 'javascript:alert(1)');
    expect(screen.getByRole('button', { name: 'Usar' })).toBeDisabled();
    type('URL da imagem', '//evil.example/a.png');
    expect(screen.getByRole('button', { name: 'Usar' })).toBeDisabled();

    type('URL da imagem', '  https://exemplo.com/foto.jpg  ');
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));

    type('Texto alternativo', 'Gráfico de barras com o uso de memória');
    type('Legenda (opcional)', 'Medido no Mac mini');
    fireEvent.click(screen.getByRole('button', { name: 'Inserir' }));

    expect(onInsert).toHaveBeenCalledWith({
      kind: 'image',
      url: 'https://exemplo.com/foto.jpg',
      alt: 'Gráfico de barras com o uso de memória',
      caption: 'Medido no Mac mini',
    });
  });

  it('upload: envia pelo modo configurado e sugere o texto alternativo pelo nome do arquivo', async () => {
    mockUpload.mockResolvedValue({ url: '/uploads/2026/10/foto-da-praia-ab12.webp' });
    const { onInsert } = open('image', 'blob');

    expect(fileInput()).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,image/gif,image/avif',
    );
    const file = new File(['x'], 'foto-da_praia.webp', { type: 'image/webp' });
    fireEvent.change(fileInput(), { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByLabelText('Texto alternativo')).toHaveValue('foto da praia'),
    );
    expect(mockUpload).toHaveBeenCalledWith(file, expect.objectContaining({ mode: 'blob' }));

    fireEvent.click(screen.getByRole('button', { name: 'Inserir' }));
    expect(onInsert).toHaveBeenCalledWith({
      kind: 'image',
      url: '/uploads/2026/10/foto-da-praia-ab12.webp',
      alt: 'foto da praia',
      caption: '',
    });
  });

  it('upload: recusa arquivo do tipo errado e mostra a falha do envio', async () => {
    open('image');

    fireEvent.change(fileInput(), {
      target: { files: [new File(['x'], 'notas.txt', { type: 'text/plain' })] },
    });
    expect(toast.error).toHaveBeenCalledWith('Escolha um arquivo de imagem.');
    expect(mockUpload).not.toHaveBeenCalled();

    mockUpload.mockRejectedValue(new Error('Arquivo maior que o limite de 15 MB.'));
    fireEvent.change(fileInput(), {
      target: { files: [new File(['x'], 'enorme.png', { type: 'image/png' })] },
    });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Arquivo maior que o limite de 15 MB.'),
    );
    expect(screen.queryByLabelText('Texto alternativo')).not.toBeInTheDocument();
  });

  it('"Trocar" volta para a escolha do arquivo', () => {
    open('image');
    tab('URL');
    type('URL da imagem', 'https://exemplo.com/a.png');
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    expect(screen.getByRole('tab', { name: 'URL' })).toBeInTheDocument();
  });
});

describe('<MediaDialog /> — biblioteca', () => {
  beforeEach(() => mockFetch.mockResolvedValue({ items: LIBRARY }));

  it('mostra só arquivos do tipo pedido e usa o nome do arquivo como sugestão', async () => {
    const { onInsert } = open('image');
    tab('Biblioteca');

    const pick = await screen.findByTitle('uploads/2026/10/praia-ab12.webp');
    expect(screen.queryByTitle('uploads/2026/10/demo-cd34.mp4')).not.toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();

    fireEvent.click(pick);
    expect(screen.getByLabelText('Texto alternativo')).toHaveValue('praia ab12');
    fireEvent.click(screen.getByRole('button', { name: 'Inserir' }));
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/uploads/2026/10/praia-ab12.webp' }),
    );
  });

  it('remove um arquivo depois de confirmar', async () => {
    open('image');
    tab('Biblioteca');
    await screen.findByTitle('uploads/2026/10/praia-ab12.webp');

    fireEvent.click(screen.getByRole('button', { name: 'Remover arquivo' }));
    expect(screen.getByText(/Posts que usam o arquivo ficarão sem ele/)).toBeInTheDocument();
    mockFetch.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() =>
      expect(screen.getByText('Nenhuma imagem enviada ainda.')).toBeInTheDocument(),
    );
    expect(mockFetch).toHaveBeenLastCalledWith('/api/admin/media', {
      method: 'DELETE',
      body: JSON.stringify({ url: '/uploads/2026/10/praia-ab12.webp' }),
    });
    expect(toast.success).toHaveBeenCalledWith('Arquivo removido da biblioteca.');
  });

  it('mostra o erro quando a biblioteca não carrega', async () => {
    mockFetch.mockRejectedValue(new Error('Sessão expirada.'));
    open('video');
    tab('Biblioteca');
    expect(await screen.findByText('Sessão expirada.')).toBeInTheDocument();
  });
});

describe('<MediaDialog /> — vídeo e capa', () => {
  it('vídeo por URL vira player com legenda (sem texto alternativo)', () => {
    const { onInsert } = open('video');
    tab('URL');
    type('URL do vídeo', 'https://exemplo.com/demo.mp4');
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));

    expect(screen.queryByLabelText('Texto alternativo')).not.toBeInTheDocument();
    expect(document.querySelector('video')).toHaveAttribute('src', 'https://exemplo.com/demo.mp4');
    type('Legenda (opcional)', 'Demonstração');
    fireEvent.click(screen.getByRole('button', { name: 'Inserir' }));
    expect(onInsert).toHaveBeenCalledWith({
      kind: 'video',
      url: 'https://exemplo.com/demo.mp4',
      caption: 'Demonstração',
    });
  });

  it('capa: sem legenda nem texto alternativo, botão "Usar como capa"', () => {
    const { onInsert } = open('cover');
    expect(
      screen.getByText('Aparece no topo do post e nas prévias de redes sociais.'),
    ).toBeInTheDocument();
    tab('URL');
    type('URL da imagem', '/uploads/2026/10/capa.png');
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));

    expect(screen.queryByLabelText('Legenda (opcional)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Texto alternativo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar como capa' }));
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'image', url: '/uploads/2026/10/capa.png' }),
    );
  });

  it('sem armazenamento (Vercel sem Blob), abre na aba URL e explica o upload', () => {
    open('image', 'disabled');
    expect(screen.getByRole('tab', { name: 'URL' })).toHaveAttribute('aria-selected', 'true');
    tab('Enviar');
    const notice = screen.getByText(/Upload indisponível neste ambiente/);
    expect(within(notice).getByText('BLOB_READ_WRITE_TOKEN')).toBeInTheDocument();
  });
});
