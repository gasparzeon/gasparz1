import { z } from 'zod';

// README do creator: um texto curto em Markdown, escrito pela própria pessoa,
// como o README do perfil no GitHub (interesses, o que pesquisa, ferramentas).
//
// Breve de propósito: 1.200 caracteres (~200 palavras, menos de um minuto de
// leitura) e 30 linhas. Cabe em duas ou três seções curtas e não compete com
// os posts. Sem imagens nem HTML (lib/markdown/readme.ts).

export const README_MAX_CHARS = 1200;
export const README_MAX_LINES = 30;

const count = (value: number) => value.toLocaleString('pt-BR');

// Quebras de linha do Windows, espaços no fim das linhas e nas pontas.
export const normalizeReadme = (value: string) =>
  value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

export const readmeLines = (value: string) => (value ? value.split('\n').length : 0);

export function readmeProblem(value: string): string | null {
  const text = normalizeReadme(value);
  if (text.length > README_MAX_CHARS) {
    return `Use no máximo ${count(README_MAX_CHARS)} caracteres (tem ${count(text.length)}).`;
  }
  const lines = readmeLines(text);
  if (lines > README_MAX_LINES) {
    return `Use no máximo ${README_MAX_LINES} linhas (tem ${lines}).`;
  }
  return null;
}

export const readmeSchema = z
  .string()
  .max(20_000, 'README muito longo.')
  .transform(normalizeReadme)
  .superRefine((text, ctx) => {
    const problem = readmeProblem(text);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });

// Ponto de partida para quem não sabe o que escrever.
export const README_TEMPLATE = `### Sobre mim
O que você pesquisa e por quê, em uma ou duas frases.

### Interesses
- segurança e privacidade
- história da internet

### Agora
Em que você está trabalhando este mês.`;
