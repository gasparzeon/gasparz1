/** @jest-environment jsdom */
import { createRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { TABLE_SNIPPET, imageMarkdown, videoMarkdown, youtubeMarkdown } from '@/lib/admin/markdown';
import { uploadMedia, validateFile } from '@/lib/admin/upload';

import { MarkdownEditor, type MarkdownEditorHandle } from '../markdown-editor';

jest.mock('@/lib/admin/upload', () => ({ uploadMedia: jest.fn(), validateFile: jest.fn() }));
jest.mock('sonner', () => ({
  toast: { loading: jest.fn(() => 'toast-1'), success: jest.fn(), error: jest.fn() },
}));

const mockUpload = uploadMedia as jest.Mock;
const mockValidate = validateFile as jest.Mock;

function setup(initial = '', mediaMode: 'local' | 'blob' = 'local') {
  const onRequestMedia = jest.fn();
  const handle = createRef<MarkdownEditorHandle>();
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <MarkdownEditor
        ref={handle}
        value={value}
        onChange={setValue}
        mediaMode={mediaMode}
        onRequestMedia={onRequestMedia}
      />
    );
  }
  render(<Harness />);
  return { onRequestMedia, handle };
}

const editor = () => screen.getByLabelText('Conteúdo do post em Markdown') as HTMLTextAreaElement;
const select = (start: number, end = start) => editor().setSelectionRange(start, end);
// Digitar no fim: o cursor vai para o fim do texto, como numa digitação real.
const typeAll = (value: string) => fireEvent.change(editor(), { target: { value } });
const pressEnter = () => fireEvent.keyDown(editor(), { key: 'Enter' });
const paste = (data: { text?: string; files?: File[] }) =>
  fireEvent.paste(editor(), {
    clipboardData: { files: data.files ?? [], getData: () => data.text ?? '' },
  });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  // O jsdom não tem execCommand: o editor cai no setRangeText (mesmo resultado).
  document.execCommand = jest.fn(() => false);
  // clearMocks zera as chamadas, não as implementações trocadas num teste.
  mockValidate.mockReset();
  mockUpload.mockReset();
});

describe('barra de formatação e atalhos', () => {
  it('negrito envolve a seleção; sem seleção, insere um exemplo já selecionado', () => {
    setup('uma palavra');
    select(4, 11);
    fireEvent.click(screen.getByRole('button', { name: 'Negrito' }));
    expect(editor().value).toBe('uma **palavra**');

    select(editor().value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Itálico' }));
    const { value, selectionStart, selectionEnd } = editor();
    expect(value).toBe('uma **palavra**_texto em itálico_');
    expect(value.slice(selectionStart, selectionEnd)).toBe('texto em itálico');
  });

  it('Ctrl+B, Ctrl+K e Ctrl+E formatam pelo teclado', () => {
    setup('veja isto');
    select(5, 9);
    fireEvent.keyDown(editor(), { key: 'b', ctrlKey: true });
    expect(editor().value).toBe('veja **isto**');

    select(0, 4);
    fireEvent.keyDown(editor(), { key: 'k', ctrlKey: true });
    expect(editor().value).toMatch(/^\[veja\]\(/);
  });

  it('título alterna o "## " da linha', () => {
    setup('Introdução');
    select(3);
    fireEvent.click(screen.getByRole('button', { name: 'Título' }));
    expect(editor().value).toBe('## Introdução');
    fireEvent.click(screen.getByRole('button', { name: 'Título' }));
    expect(editor().value).toBe('Introdução');
  });

  it('imagem, vídeo e YouTube abrem a janela de mídia', () => {
    const { onRequestMedia } = setup();
    for (const [label, kind] of [
      ['Imagem', 'image'],
      ['Vídeo', 'video'],
      ['YouTube', 'youtube'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(onRequestMedia).toHaveBeenLastCalledWith(kind);
    }
  });

  it('o botão "Guia" abre o guia de Markdown', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Guia/ }));
    expect(screen.getByText('Guia de Markdown')).toBeInTheDocument();
  });
});

describe('menu "/"', () => {
  it('abre no começo da linha e filtra pelo que é digitado (sem acento)', () => {
    setup();
    typeAll('Texto\n/');
    expect(screen.getByRole('listbox', { name: 'Inserir bloco' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Imagem/ })).toHaveAttribute('aria-selected', 'true');

    typeAll('Texto\n/formu');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      expect.stringContaining('Fórmula'),
    ]);
  });

  it('Enter insere o bloco escolhido no lugar do comando', () => {
    setup();
    typeAll('Texto\n/tab');
    pressEnter();
    expect(editor().value).not.toContain('/tab');
    expect(editor().value).toContain(TABLE_SNIPPET);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('setas mudam a opção; mídia vai para a janela de mídia', () => {
    const { onRequestMedia } = setup();
    typeAll('/');
    fireEvent.keyDown(editor(), { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Vídeo/ })).toHaveAttribute('aria-selected', 'true');
    pressEnter();
    expect(onRequestMedia).toHaveBeenCalledWith('video');
    expect(editor().value).toBe('');
  });

  it('Esc fecha; dentro de bloco de código e no meio da frase não abre', () => {
    setup();
    typeAll('/');
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    typeAll('```\n/');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    typeAll('caminho a/b');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('listas continuam com Enter', () => {
  it.each([
    ['- item', '- item\n- '],
    ['1. um', '1. um\n2. '],
    ['- [x] feito', '- [x] feito\n- [ ] '],
    ['> citação', '> citação\n> '],
  ])('%s', (start, expected) => {
    setup(start);
    select(start.length);
    pressEnter();
    expect(editor().value).toBe(expected);
  });

  it('Enter num item vazio encerra a lista', () => {
    setup('- item\n- ');
    select(editor().value.length);
    pressEnter();
    expect(editor().value).toBe('- item\n\n');
  });

  it('dentro de bloco de código, Enter é só uma quebra de linha', () => {
    setup('```\n- item');
    select(editor().value.length);
    expect(pressEnter()).toBe(true); // não foi interceptado
    expect(editor().value).toBe('```\n- item');
  });
});

describe('colar', () => {
  it('link do YouTube numa linha vazia vira player', () => {
    setup();
    expect(paste({ text: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42' })).toBe(false);
    expect(editor().value).toContain(youtubeMarkdown('dQw4w9WgXcQ', 42));
  });

  it('URL de imagem ou vídeo numa linha vazia vira mídia', () => {
    setup();
    paste({ text: 'https://exemplo.com/fotos/praia.webp' });
    expect(editor().value).toContain(imageMarkdown('https://exemplo.com/fotos/praia.webp', ''));

    select(editor().value.length);
    fireEvent.change(editor(), { target: { value: `${editor().value}\n\n` } });
    paste({ text: 'https://exemplo.com/demo.mp4' });
    expect(editor().value).toContain(videoMarkdown('https://exemplo.com/demo.mp4'));
  });

  it('URL colada sobre texto selecionado vira link', () => {
    setup('veja o site');
    select(7, 11);
    paste({ text: 'https://exemplo.com' });
    expect(editor().value).toBe('veja o [site](https://exemplo.com)');
  });

  it('no meio de um parágrafo, dentro de código ou com texto comum, cola normalmente', () => {
    setup('texto ');
    select(6);
    expect(paste({ text: 'https://youtu.be/dQw4w9WgXcQ' })).toBe(true);
    expect(paste({ text: 'só um texto' })).toBe(true);
    expect(editor().value).toBe('texto ');
  });

  it('dentro de bloco de código, URL do YouTube não vira player', () => {
    setup('```\n');
    select(4);
    expect(paste({ text: 'https://youtu.be/dQw4w9WgXcQ' })).toBe(true);
  });
});

describe('upload ao colar, arrastar ou escolher arquivo', () => {
  const photo = () => new File(['x'], 'foto-praia.png', { type: 'image/png' });

  it('mostra um marcador enquanto envia e troca pela imagem com texto alternativo', async () => {
    const upload = deferred<{ url: string; kind: 'image' }>();
    mockUpload.mockReturnValue(upload.promise);
    setup('', 'blob');

    paste({ files: [photo()] });
    expect(editor().value).toMatch(/!\[Enviando foto-praia\.png… \(\w+\)\]\(\)/);
    expect(mockUpload).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ mode: 'blob' }),
    );
    expect(toast.loading).toHaveBeenCalledWith('Enviando foto-praia.png…');

    await act(async () =>
      upload.resolve({ url: '/uploads/2026/10/foto-praia-ab.png', kind: 'image' }),
    );

    // Blocos entram com uma linha em branco depois, para o próximo parágrafo.
    expect(editor().value.trim()).toBe(
      imageMarkdown('/uploads/2026/10/foto-praia-ab.png', 'foto praia'),
    );
    expect(toast.success).toHaveBeenCalledWith('foto-praia.png enviado', { id: 'toast-1' });
  });

  it('vídeo enviado vira player', async () => {
    mockUpload.mockResolvedValue({ url: '/uploads/2026/10/demo.mp4', kind: 'video' });
    setup();
    paste({ files: [new File(['x'], 'demo.mp4', { type: 'video/mp4' })] });
    await waitFor(() =>
      expect(editor().value.trim()).toBe(videoMarkdown('/uploads/2026/10/demo.mp4')),
    );
  });

  it('se o envio falhar, o marcador some e o erro aparece', async () => {
    mockUpload.mockRejectedValue(new Error('Arquivo maior que o limite de 15 MB.'));
    setup('Antes');
    select(5);
    paste({ files: [photo()] });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Arquivo maior que o limite de 15 MB.', {
        id: 'toast-1',
      }),
    );
    expect(editor().value).not.toContain('Enviando');
    expect(editor().value.trim()).toBe('Antes');
  });

  it('arquivo recusado na validação nem começa a subir', () => {
    mockValidate.mockImplementation(() => {
      throw new Error('Formato não suportado.');
    });
    setup();
    fireEvent.drop(editor(), { dataTransfer: { files: [photo()] } });
    expect(toast.error).toHaveBeenCalledWith('Formato não suportado.');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(editor().value).toBe('');
  });

  it('arrastar mostra o aviso para soltar e envia vários arquivos em ordem', async () => {
    mockUpload
      .mockResolvedValueOnce({ url: '/uploads/a.png', kind: 'image' })
      .mockResolvedValueOnce({ url: '/uploads/b.png', kind: 'image' });
    setup();

    fireEvent.dragOver(editor(), { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('Solte para enviar imagens ou vídeos')).toBeInTheDocument();

    fireEvent.drop(editor(), {
      dataTransfer: {
        files: [
          new File(['a'], 'a.png', { type: 'image/png' }),
          new File(['b'], 'b.png', { type: 'image/png' }),
        ],
      },
    });
    expect(screen.queryByText('Solte para enviar imagens ou vídeos')).not.toBeInTheDocument();

    await waitFor(() => expect(editor().value).toContain(imageMarkdown('/uploads/b.png', 'b')));
    expect(editor().value.indexOf('/uploads/a.png')).toBeLessThan(
      editor().value.indexOf('/uploads/b.png'),
    );
  });

  it('"Enviar mídia" usa o seletor de arquivos (imagens e vídeos aceitos)', async () => {
    mockUpload.mockResolvedValue({ url: '/uploads/c.webp', kind: 'image' });
    setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm',
    );
    fireEvent.change(input, {
      target: { files: [new File(['c'], 'c.webp', { type: 'image/webp' })] },
    });
    await waitFor(() => expect(editor().value).toContain('/uploads/c.webp'));
  });

  it('colar texto com um arquivo que não é mídia não dispara upload', () => {
    setup();
    expect(
      paste({ files: [new File(['x'], 'notas.txt', { type: 'text/plain' })], text: 'oi' }),
    ).toBe(true);
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('controle pelo editor de post (ref)', () => {
  it('replaceAll troca o texto inteiro; insert adiciona um bloco; goToLine posiciona o cursor', () => {
    const { handle } = setup('linha 1\nlinha 2\nlinha 3');

    act(() => {
      handle.current?.goToLine(3);
    });
    expect(editor().selectionStart).toBe('linha 1\nlinha 2\n'.length);

    let replaced = false;
    act(() => {
      replaced = handle.current?.replaceAll('novo texto') ?? false;
    });
    expect(replaced).toBe(true);
    expect(editor().value).toBe('novo texto');

    act(() => {
      handle.current?.insert('![a](/uploads/a.png)');
    });
    expect(editor().value).toContain('![a](/uploads/a.png)');
  });
});
