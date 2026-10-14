import type { ReactNode } from 'react';

// Título com uma palavra destacada (configurada no painel). Se o destaque não
// estiver dentro do título, entra depois dele (como o "Labs" antigo).
export function Highlight({ text, accent }: { text: string; accent?: string }): ReactNode {
  const word = accent?.trim();
  if (!word) return text;
  const at = text.indexOf(word);
  if (at === -1) {
    return (
      <>
        {text} <mark className="gz-mark">{word}</mark>
      </>
    );
  }
  return (
    <>
      {text.slice(0, at)}
      <mark className="gz-mark">{word}</mark>
      {text.slice(at + word.length)}
    </>
  );
}

// Texto livre do painel em que *palavra* vira destaque.
export function StarMarks({ text }: { text: string }): ReactNode {
  return text.split(/(\*[^*\n]+\*)/g).map((part, index) =>
    /^\*[^*\n]+\*$/.test(part) ? (
      <mark key={index} className="gz-mark">
        {part.slice(1, -1)}
      </mark>
    ) : (
      part
    ),
  );
}

// Hex dump (estilo `xxd`) de um texto, em linhas de 8 bytes.
export function hexDump(text: string, lines = 3) {
  const bytes = Array.from(new TextEncoder().encode(text)).slice(0, lines * 8);
  const rows: { offset: string; hex: string; ascii: string }[] = [];
  for (let i = 0; i < bytes.length; i += 8) {
    const chunk = bytes.slice(i, i + 8);
    rows.push({
      offset: i.toString(16).padStart(8, '0'),
      hex: chunk
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(' ')
        .padEnd(23, ' '),
      ascii: chunk
        .map((byte) => (byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.'))
        .join(''),
    });
  }
  return rows;
}
