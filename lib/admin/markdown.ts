// Transformações de texto do editor. Funções puras: recebem o texto e a
// seleção e devolvem a edição mínima a aplicar, o que preserva o desfazer
// (Ctrl+Z) nativo do navegador.

export type Selection = { value: string; start: number; end: number };

export type Edit = {
  from: number;
  to: number;
  insert: string;
  // Seleção final, em coordenadas do documento já editado.
  selection: [number, number];
};

// eslint-disable-next-line security/detect-unsafe-regex -- ancorada no início e aplicada a uma linha; alternativas com delimitadores fixos, sem backtracking exponencial
const BLOCK_PREFIX_RE = /^(#{1,6}\s+|>\s?|[-*+]\s+(\[[ x]\]\s+)?|\d+\.\s+)/;

export function wrap(
  { value, start, end }: Selection,
  before: string,
  after: string,
  placeholder: string,
): Edit {
  const selected = value.slice(start, end);

  // Já envolvido por fora da seleção: remove os marcadores.
  if (
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after
  ) {
    return {
      from: start - before.length,
      to: end + after.length,
      insert: selected,
      selection: [start - before.length, end - before.length],
    };
  }

  // Marcadores dentro da seleção.
  if (
    selected.length >= before.length + after.length &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return { from: start, to: end, insert: inner, selection: [start, start + inner.length] };
  }

  const text = selected || placeholder;
  return {
    from: start,
    to: end,
    insert: before + text + after,
    selection: [start + before.length, start + before.length + text.length],
  };
}

function lineBounds(value: string, start: number, end: number) {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const newline = value.indexOf('\n', effectiveEnd);
  return { from, to: newline === -1 ? value.length : newline };
}

export type LineStyle = 'h2' | 'h3' | 'quote' | 'ul' | 'ol' | 'task';

const PREFIX: Record<Exclude<LineStyle, 'ol'>, string> = {
  h2: '## ',
  h3: '### ',
  quote: '> ',
  ul: '- ',
  task: '- [ ] ',
};

function hasStyle(line: string, style: LineStyle) {
  if (style === 'ol') return /^\d+\.\s/.test(line);
  if (style === 'ul') return /^[-*+]\s/.test(line) && !/^[-*+]\s\[[ x]\]\s/.test(line);
  // eslint-disable-next-line security/detect-object-injection -- chave tipada (união literal do código), não vem de entrada externa
  return line.startsWith(PREFIX[style]);
}

// Aplica (ou remove, se todas as linhas já tiverem) um estilo de bloco
// nas linhas da seleção, trocando qualquer outro prefixo de bloco.
export function toggleLineStyle({ value, start, end }: Selection, style: LineStyle): Edit {
  const { from, to } = lineBounds(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const content = lines.filter((line) => line.trim());
  const remove = content.length > 0 && content.every((line) => hasStyle(line, style));

  let counter = 0;
  const next = lines.map((line) => {
    if (!line.trim() && lines.length > 1) return line;
    const stripped = line.replace(BLOCK_PREFIX_RE, '');
    if (remove) return stripped;
    counter += 1;
    // eslint-disable-next-line security/detect-object-injection -- chave tipada (união literal do código), não vem de entrada externa
    return (style === 'ol' ? `${counter}. ` : PREFIX[style]) + stripped;
  });

  const insert = next.join('\n');
  const caret = from + insert.length;

  return {
    from,
    to,
    insert,
    selection: lines.length === 1 ? [caret, caret] : [from, caret],
  };
}

// Insere um bloco em parágrafo próprio (linha em branco antes e depois).
// `select` indica, dentro do bloco, o trecho a deixar selecionado.
export function insertBlock(
  { value, start, end }: Selection,
  block: string,
  select?: [number, number],
): Edit {
  const before = value.slice(0, start);
  const after = value.slice(end);

  const lead =
    before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  // O cursor vai para um parágrafo novo e vazio depois do bloco; o texto
  // que já vinha depois continua separado por uma linha em branco.
  const pad =
    after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';

  const insert = lead + block + '\n\n' + pad;
  const blockStart = start + lead.length;
  const caret = blockStart + block.length + 2;

  return {
    from: start,
    to: end,
    insert,
    selection: select ? [blockStart + select[0], blockStart + select[1]] : [caret, caret],
  };
}

export function isUrl(text: string) {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

export function link(selection: Selection): Edit {
  const { value, start, end } = selection;
  const selected = value.slice(start, end);

  if (isUrl(selected)) {
    const label = 'texto do link';
    return {
      from: start,
      to: end,
      insert: `[${label}](${selected.trim()})`,
      selection: [start + 1, start + 1 + label.length],
    };
  }

  const label = selected || 'texto do link';
  const url = 'https://';
  const insert = `[${label}](${url})`;
  const urlStart = start + label.length + 3;

  return { from: start, to: end, insert, selection: [urlStart, urlStart + url.length] };
}

export function codeBlock(selection: Selection): Edit {
  const selected = selection.value.slice(selection.start, selection.end);
  const body = selected || 'código';
  const block = '```\n' + body + '\n```';
  return insertBlock(selection, block, [4, 4 + body.length]);
}

// ——— Snippets (Markdown puro, portátil para qualquer editor) ———

function escapeMarkdownText(value: string) {
  return value
    .replace(/[\\[\]]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function escapeUrl(url: string) {
  return url.trim().replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function title(caption?: string) {
  return caption?.trim() ? ` "${caption.trim().replace(/"/g, '\\"')}"` : '';
}

// ![texto alternativo](url "legenda") — vira <figure> no site.
export function imageMarkdown(url: string, alt: string, caption?: string) {
  return `![${escapeMarkdownText(alt)}](${escapeUrl(url)}${title(caption)})`;
}

// Vídeo usa a mesma sintaxe de imagem: o site troca por um player.
export function videoMarkdown(url: string, caption?: string) {
  return `![${escapeMarkdownText(caption ?? '')}](${escapeUrl(url)})`;
}

// Link sozinho na linha vira embed; com legenda, usa a sintaxe de imagem.
export function youtubeMarkdown(id: string, start?: number, caption?: string) {
  const url = `https://youtu.be/${id}${start ? `?t=${start}` : ''}`;
  return caption?.trim() ? `![${escapeMarkdownText(caption)}](${url})` : url;
}

export function altFromFileName(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Alertas no padrão do GitHub: NOTE, TIP, IMPORTANT, WARNING, CAUTION.
export const CALLOUT_SNIPPET = '> [!TIP]\n> Escreva o destaque aqui.';

export const TABLE_SNIPPET = '| Coluna | Coluna |\n| --- | --- |\n| Valor | Valor |';

export const MATH_SNIPPET = '$$\nE = mc^2\n$$';

export const DETAILS_SNIPPET =
  '<details>\n<summary>Clique para expandir</summary>\n\nConteúdo escondido.\n\n</details>';

// Nota de rodapé: a referência no texto e a definição no fim do documento.
// A referência entra logo depois da seleção (sem apagar o texto selecionado).
export function footnote({ value, end }: Selection): Edit {
  const used = new Set(Array.from(value.matchAll(/\[\^(\d+)\]/g), (match) => Number(match[1])));
  let n = 1;
  while (used.has(n)) n += 1;

  const reference = `[^${n}]`;
  const definitionText = 'Texto da nota.';
  const tail = value.slice(end);
  const separator = tail.endsWith('\n\n') ? '' : tail.endsWith('\n') ? '\n' : '\n\n';
  const definition = `${separator}[^${n}]: ${definitionText}`;

  const insert = reference + tail + definition;
  const definitionStart =
    end + reference.length + tail.length + separator.length + reference.length + 2;
  return {
    from: end,
    to: value.length,
    insert,
    selection: [definitionStart, definitionStart + definitionText.length],
  };
}
