'use client';

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookOpen,
  Bold,
  ChevronsDownUp,
  Code,
  Film,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  SquareCode,
  Superscript,
  Strikethrough,
  Table,
  Upload,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { caretCoordinates } from '@/lib/admin/caret';
import {
  CALLOUT_SNIPPET,
  DETAILS_SNIPPET,
  MATH_SNIPPET,
  TABLE_SNIPPET,
  altFromFileName,
  codeBlock,
  footnote,
  imageMarkdown,
  insertBlock,
  isUrl,
  link,
  toggleLineStyle,
  videoMarkdown,
  wrap,
  youtubeMarkdown,
  type Edit,
  type LineStyle,
  type Selection,
} from '@/lib/admin/markdown';
import { uploadMedia, validateFile } from '@/lib/admin/upload';
import { isVideoUrl, mediaKindOf, type MediaMode } from '@/lib/cms/media-types';
import { parseYouTube } from '@/lib/markdown/youtube';
import { Kbd } from '@/components/ui/kbd';
import { MarkdownGuide } from './markdown-guide';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type MediaRequest = 'image' | 'video' | 'youtube';

type CommandId =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link'
  | LineStyle
  | 'codeblock'
  | 'divider'
  | 'table'
  | 'callout'
  | 'math'
  | 'footnote'
  | 'details'
  | MediaRequest;

type Command = {
  id: CommandId;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  description?: string;
  keywords?: string;
};

const COMMANDS: Record<CommandId, Command> = {
  bold: { id: 'bold', label: 'Negrito', icon: Bold, shortcut: 'B' },
  italic: { id: 'italic', label: 'Itálico', icon: Italic, shortcut: 'I' },
  strike: { id: 'strike', label: 'Riscado', icon: Strikethrough },
  code: { id: 'code', label: 'Código inline', icon: Code, shortcut: 'E' },
  link: { id: 'link', label: 'Link', icon: Link2, shortcut: 'K' },
  h2: {
    id: 'h2',
    label: 'Título',
    icon: Heading2,
    description: 'Seção principal',
    keywords: 'titulo heading h2',
  },
  h3: {
    id: 'h3',
    label: 'Subtítulo',
    icon: Heading3,
    description: 'Subseção',
    keywords: 'subtitulo heading h3',
  },
  quote: {
    id: 'quote',
    label: 'Citação',
    icon: Quote,
    description: 'Bloco de citação',
    keywords: 'citacao quote',
  },
  ul: {
    id: 'ul',
    label: 'Lista',
    icon: List,
    description: 'Lista com marcadores',
    keywords: 'lista bullet',
  },
  ol: {
    id: 'ol',
    label: 'Lista numerada',
    icon: ListOrdered,
    description: '1. 2. 3.',
    keywords: 'lista numerada ordenada',
  },
  task: {
    id: 'task',
    label: 'Checklist',
    icon: ListChecks,
    description: 'Lista de tarefas',
    keywords: 'tarefas checklist todo',
  },
  codeblock: {
    id: 'codeblock',
    label: 'Bloco de código',
    icon: SquareCode,
    description: 'Código com destaque',
    keywords: 'codigo code',
  },
  divider: {
    id: 'divider',
    label: 'Divisor',
    icon: Minus,
    description: 'Linha horizontal',
    keywords: 'divisor separador hr',
  },
  table: {
    id: 'table',
    label: 'Tabela',
    icon: Table,
    description: 'Tabela simples',
    keywords: 'tabela table',
  },
  callout: {
    id: 'callout',
    label: 'Destaque',
    icon: Info,
    description: 'Nota, dica ou aviso (> [!TIP])',
    keywords: 'destaque callout aviso nota alerta dica',
  },
  math: {
    id: 'math',
    label: 'Fórmula',
    icon: Sigma,
    description: 'LaTeX entre $$',
    keywords: 'formula matematica latex katex equacao',
  },
  footnote: {
    id: 'footnote',
    label: 'Nota de rodapé',
    icon: Superscript,
    description: 'Referência [^1] com nota no fim',
    keywords: 'nota rodape footnote referencia',
  },
  details: {
    id: 'details',
    label: 'Bloco expansível',
    icon: ChevronsDownUp,
    description: 'Conteúdo que abre ao clicar',
    keywords: 'detalhes expandir details spoiler',
  },
  image: {
    id: 'image',
    label: 'Imagem',
    icon: ImageIcon,
    description: 'Enviar, colar URL ou biblioteca',
    keywords: 'imagem foto figura image',
  },
  video: {
    id: 'video',
    label: 'Vídeo',
    icon: Film,
    description: 'MP4 ou WebM',
    keywords: 'video filme mp4',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    description: 'Incorporar vídeo do YouTube',
    keywords: 'youtube embed',
  },
};

const TOOLBAR: CommandId[][] = [
  ['h2', 'h3'],
  ['bold', 'italic', 'strike', 'code', 'link'],
  ['quote', 'ul', 'ol', 'task', 'codeblock', 'table'],
  ['image', 'video', 'youtube', 'callout'],
  ['math', 'footnote', 'details', 'divider'],
];

// event.key vem do teclado: Map em vez de objeto (sem chaves de prototype).
const SHORTCUTS = new Map<string, CommandId>([
  ['b', 'bold'],
  ['i', 'italic'],
  ['k', 'link'],
  ['e', 'code'],
]);

const SLASH: CommandId[] = [
  'image',
  'video',
  'youtube',
  'h2',
  'h3',
  'quote',
  'ul',
  'ol',
  'task',
  'codeblock',
  'callout',
  'table',
  'math',
  'footnote',
  'details',
  'divider',
];

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function isImageUrl(text: string) {
  try {
    return IMAGE_EXTENSION_RE.test(new URL(text).pathname);
  } catch {
    return false;
  }
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function lineAt(value: string, index: number) {
  const start = value.lastIndexOf('\n', index - 1) + 1;
  const newline = value.indexOf('\n', index);
  return { start, end: newline === -1 ? value.length : newline };
}

function insideCodeFence(value: string, index: number) {
  return (value.slice(0, index).match(/^```/gm)?.length ?? 0) % 2 === 1;
}

const supportsFieldSizing = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

export type MarkdownEditorHandle = {
  focus(): void;
  insert(block: string): void;
  goToLine(line: number): void;
  // Troca o texto inteiro mantendo o Ctrl+Z. Retorna false se o editor não
  // estiver montado (ex.: modo "Visualizar").
  replaceAll(text: string): boolean;
};

type SlashState = {
  from: number;
  query: string;
  top: number;
  left: number;
  index: number;
};

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  mediaMode: MediaMode;
  onRequestMedia: (kind: MediaRequest) => void;
  className?: string;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, mediaMode, onRequestMedia, className }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [slash, setSlash] = useState<SlashState | null>(null);
    const [guideOpen, setGuideOpen] = useState(false);
    const [dragging, setDragging] = useState(false);

    const isMac = useMemo(
      () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform),
      [],
    );
    const mod = isMac ? '⌘' : 'Ctrl';

    useLayoutEffect(() => {
      const element = textareaRef.current;
      if (!element || supportsFieldSizing) return;
      const scroller = element.closest<HTMLElement>('[data-editor-scroll]');
      const top = scroller?.scrollTop ?? 0;
      element.style.height = '0px';
      element.style.height = `${element.scrollHeight}px`;
      if (scroller) scroller.scrollTop = top;
    }, [value]);

    const selection = (): Selection => {
      const element = textareaRef.current!;
      return {
        value: element.value,
        start: element.selectionStart,
        end: element.selectionEnd,
      };
    };

    // Aplica a edição via execCommand para manter o histórico de desfazer.
    const apply = useCallback(
      (edit: Edit) => {
        const element = textareaRef.current;
        if (!element) return;
        if (edit.from === edit.to && edit.insert === '') return;

        element.focus();
        element.setSelectionRange(edit.from, edit.to);

        let applied = false;
        try {
          applied = edit.insert
            ? document.execCommand('insertText', false, edit.insert)
            : document.execCommand('delete');
        } catch {
          applied = false;
        }

        if (!applied) {
          element.setRangeText(edit.insert, edit.from, edit.to, 'end');
          onChange(element.value);
        }

        element.setSelectionRange(edit.selection[0], edit.selection[1]);
      },
      [onChange],
    );

    // Troca o placeholder de upload sem roubar o foco de outro campo.
    const replacePlaceholder = useCallback(
      (placeholder: string, replacement: string) => {
        const element = textareaRef.current;
        if (!element) return;
        const index = element.value.indexOf(placeholder);
        if (index === -1) return;

        let to = index + placeholder.length;
        if (!replacement && element.value.slice(to, to + 2) === '\n\n') to += 2;

        if (document.activeElement === element) {
          const { selectionStart, selectionEnd } = element;
          const delta = replacement.length - (to - index);
          const shift = (position: number) => (position >= to ? position + delta : position);
          apply({
            from: index,
            to,
            insert: replacement,
            selection: [shift(selectionStart), shift(selectionEnd)],
          });
        } else {
          onChange(element.value.slice(0, index) + replacement + element.value.slice(to));
        }
      },
      [apply, onChange],
    );

    const uploadFiles = useCallback(
      async (files: File[]) => {
        for (const file of files) {
          try {
            validateFile(file);
          } catch (error) {
            toast.error((error as Error).message);
            continue;
          }

          const token = Math.random().toString(36).slice(2, 8);
          const placeholder = `![Enviando ${file.name.replace(/[[\]]/g, '')}… (${token})]()`;
          apply(insertBlock(selection(), placeholder));

          const toastId = toast.loading(`Enviando ${file.name}…`);
          try {
            const result = await uploadMedia(file, {
              mode: mediaMode,
              onProgress: (fraction) =>
                toast.loading(`Enviando ${file.name}… ${Math.round(fraction * 100)}%`, {
                  id: toastId,
                }),
            });
            replacePlaceholder(
              placeholder,
              result.kind === 'image'
                ? imageMarkdown(result.url, altFromFileName(file.name))
                : videoMarkdown(result.url),
            );
            toast.success(`${file.name} enviado`, { id: toastId });
          } catch (error) {
            replacePlaceholder(placeholder, '');
            toast.error((error as Error).message, { id: toastId });
          }
        }
      },
      [apply, mediaMode, replacePlaceholder],
    );

    const run = useCallback(
      (id: CommandId) => {
        const current = selection();
        switch (id) {
          case 'bold':
            return apply(wrap(current, '**', '**', 'texto em negrito'));
          case 'italic':
            return apply(wrap(current, '_', '_', 'texto em itálico'));
          case 'strike':
            return apply(wrap(current, '~~', '~~', 'texto riscado'));
          case 'code':
            return apply(wrap(current, '`', '`', 'código'));
          case 'link':
            return apply(link(current));
          case 'h2':
          case 'h3':
          case 'quote':
          case 'ul':
          case 'ol':
          case 'task':
            return apply(toggleLineStyle(current, id));
          case 'codeblock':
            return apply(codeBlock(current));
          case 'divider':
            return apply(insertBlock(current, '---'));
          case 'table':
            return apply(insertBlock(current, TABLE_SNIPPET, [2, 8]));
          case 'math':
            return apply(insertBlock(current, MATH_SNIPPET, [3, MATH_SNIPPET.length - 3]));
          case 'footnote':
            return apply(footnote(current));
          case 'details': {
            const text = 'Conteúdo escondido.';
            const at = DETAILS_SNIPPET.indexOf(text);
            return apply(insertBlock(current, DETAILS_SNIPPET, [at, at + text.length]));
          }
          case 'callout': {
            const text = 'Escreva o destaque aqui.';
            const at = CALLOUT_SNIPPET.indexOf(text);
            return apply(insertBlock(current, CALLOUT_SNIPPET, [at, at + text.length]));
          }
          case 'image':
          case 'video':
          case 'youtube':
            return onRequestMedia(id);
        }
      },
      [apply, onRequestMedia],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        insert: (block: string) => {
          if (!textareaRef.current) return;
          apply(insertBlock(selection(), block));
        },
        replaceAll: (text: string) => {
          const element = textareaRef.current;
          if (!element) return false;
          apply({ from: 0, to: element.value.length, insert: text, selection: [0, 0] });
          return true;
        },
        goToLine: (line: number) => {
          const element = textareaRef.current;
          if (!element) return;
          const lines = element.value.split('\n');
          const index = lines
            .slice(0, Math.max(0, line - 1))
            .reduce((sum, l) => sum + l.length + 1, 0);
          element.focus();
          element.setSelectionRange(index, index);
          const scroller = element.closest<HTMLElement>('[data-editor-scroll]');
          if (scroller) {
            const { top } = caretCoordinates(element, index);
            const offset =
              element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
            scroller.scrollTo({ top: scroller.scrollTop + offset + top - 120, behavior: 'smooth' });
          }
        },
      }),
      [apply],
    );

    const slashItems = useMemo(() => {
      if (!slash) return [];
      const query = normalize(slash.query);
      // eslint-disable-next-line security/detect-object-injection -- chave tipada (união literal do código), não vem de entrada externa
      return SLASH.map((id) => COMMANDS[id]).filter(
        (command) =>
          !query ||
          normalize(command.label).includes(query) ||
          normalize(command.keywords ?? '').includes(query),
      );
    }, [slash]);

    const updateSlash = (element: HTMLTextAreaElement) => {
      const caret = element.selectionStart;
      if (caret !== element.selectionEnd || insideCodeFence(element.value, caret)) {
        setSlash(null);
        return;
      }
      const lineStart = element.value.lastIndexOf('\n', caret - 1) + 1;
      const match = element.value.slice(lineStart, caret).match(/^\/([\p{L}\p{N}]{0,20})$/u);
      if (!match) {
        setSlash(null);
        return;
      }
      const coordinates = caretCoordinates(element, lineStart);
      setSlash((previous) => ({
        from: lineStart,
        query: match[1],
        top: coordinates.top + coordinates.lineHeight + 4,
        left: coordinates.left,
        index: previous?.from === lineStart && previous.query === match[1] ? previous.index : 0,
      }));
    };

    const chooseSlash = (command: Command) => {
      const element = textareaRef.current;
      if (!element || !slash) return;
      const caret = element.selectionStart;
      setSlash(null);
      apply({ from: slash.from, to: caret, insert: '', selection: [slash.from, slash.from] });
      run(command.id);
    };

    const continueList = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const { value: text, start, end } = selection();
      if (start !== end || insideCodeFence(text, start)) return false;

      const line = lineAt(text, start);
      const before = text.slice(line.start, start);
      const match = before.match(/^(\s*)([-*+] \[[ x]\] |[-*+] |(\d+)\. |> )/);
      if (!match) return false;

      event.preventDefault();

      // Item vazio: encerra a lista com uma linha em branco, senão o
      // parágrafo seguinte vira continuação do último item.
      if (text.slice(line.start, line.end).trim() === match[0].trim()) {
        apply({
          from: line.start,
          to: line.end,
          insert: '\n',
          selection: [line.start + 1, line.start + 1],
        });
        return true;
      }

      const next = match[3]
        ? `${match[1]}${Number(match[3]) + 1}. `
        : match[1] + match[2].replace('[x]', '[ ]');
      const caret = start + 1 + next.length;
      apply({ from: start, to: start, insert: `\n${next}`, selection: [caret, caret] });
      return true;
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slash && slashItems.length > 0) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          setSlash({
            ...slash,
            index: (slash.index + delta + slashItems.length) % slashItems.length,
          });
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          chooseSlash(slashItems[slash.index] ?? slashItems[0]);
          return;
        }
      }
      if (slash && event.key === 'Escape') {
        event.preventDefault();
        setSlash(null);
        return;
      }

      const modKey = isMac ? event.metaKey : event.ctrlKey;
      if (modKey && !event.altKey) {
        const key = event.key.toLowerCase();
        const command = SHORTCUTS.get(key);
        if (!event.shiftKey && command) {
          event.preventDefault();
          run(command);
          return;
        }
      }

      if (event.key === 'Enter' && !event.shiftKey && !modKey) {
        continueList(event);
      }
    };

    const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(event.clipboardData.files).filter((file) => mediaKindOf(file.type));
      if (files.length > 0) {
        event.preventDefault();
        void uploadFiles(files);
        return;
      }

      const text = event.clipboardData.getData('text/plain').trim();
      if (!isUrl(text)) return;

      const current = selection();
      const selected = current.value.slice(current.start, current.end);
      const line = lineAt(current.value, current.start);
      const lineIsEmpty =
        current.start === current.end && current.value.slice(line.start, line.end).trim() === '';

      if (lineIsEmpty && !insideCodeFence(current.value, current.start)) {
        const youtube = parseYouTube(text);
        let block: string | null = null;
        if (youtube) block = youtubeMarkdown(youtube.id, youtube.start);
        else if (isImageUrl(text)) block = imageMarkdown(text, '');
        else if (isVideoUrl(text)) block = videoMarkdown(text);

        if (block) {
          event.preventDefault();
          apply(insertBlock(current, block));
          return;
        }
      }

      // URL colada sobre texto selecionado vira link.
      if (selected && !isUrl(selected) && !selected.includes('\n')) {
        event.preventDefault();
        const insert = `[${selected}](${text})`;
        const caret = current.start + insert.length;
        apply({ from: current.start, to: current.end, insert, selection: [caret, caret] });
      }
    };

    const onDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
      setDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) return;
      event.preventDefault();
      void uploadFiles(files);
    };

    return (
      <div className={cn('relative', className)}>
        <div
          role="toolbar"
          aria-label="Formatação"
          className="sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-background/90 px-1 py-2 backdrop-blur"
        >
          {TOOLBAR.map((group, groupIndex) => (
            <div key={groupIndex} className="flex items-center gap-0.5">
              {groupIndex > 0 && <span className="mx-1.5 h-5 w-px bg-border" aria-hidden />}
              {group.map((id) => {
                // eslint-disable-next-line security/detect-object-injection -- chave tipada (união literal do código), não vem de entrada externa
                const command = COMMANDS[id];
                const Icon = command.icon;
                return (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => run(id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        aria-label={command.label}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="flex items-center gap-2">
                      {command.label}
                      {command.shortcut && (
                        <Kbd>
                          {mod}+{command.shortcut}
                        </Kbd>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}

          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Guia</span>
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Enviar mídia</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Também dá para colar ou arrastar arquivos no texto
              </TooltipContent>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm"
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (files.length) void uploadFiles(files);
              }}
            />
          </div>
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              updateSlash(event.target);
            }}
            onKeyDown={onKeyDown}
            onSelect={(event) => {
              if (slash) updateSlash(event.currentTarget);
            }}
            onBlur={() => setSlash(null)}
            onPaste={onPaste}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            placeholder={
              'Comece a escrever… Digite "/" para inserir imagens, vídeos, YouTube e mais.'
            }
            spellCheck
            lang="pt-BR"
            aria-label="Conteúdo do post em Markdown"
            className="block [field-sizing:content] min-h-[60vh] w-full resize-none overflow-hidden bg-transparent font-mono text-[15px] leading-7 text-foreground/90 outline-none placeholder:text-muted-foreground focus-visible:outline-none"
          />

          {dragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-sm border-2 border-dashed border-link bg-background/80 text-sm text-muted-foreground">
              Solte para enviar imagens ou vídeos
            </div>
          )}

          {slash && slashItems.length > 0 && (
            <div
              role="listbox"
              aria-label="Inserir bloco"
              className="absolute z-30 w-72 overflow-hidden rounded-sm border border-border bg-popover p-1 shadow-2xl shadow-black/50"
              style={{ top: slash.top, left: Math.max(0, slash.left) }}
            >
              <p className="px-2.5 pt-1.5 pb-1 text-xs tracking-wider text-muted-foreground uppercase">
                Inserir
              </p>
              <div className="max-h-80 overflow-y-auto">
                {slashItems.map((command, index) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      role="option"
                      aria-selected={index === slash.index}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        chooseSlash(command);
                      }}
                      onMouseEnter={() => setSlash({ ...slash, index })}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                        index === slash.index ? 'bg-secondary' : 'hover:bg-secondary/60',
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{command.label}</span>
                        {command.description && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {command.description}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <MarkdownGuide open={guideOpen} onOpenChange={setGuideOpen} />
      </div>
    );
  },
);
