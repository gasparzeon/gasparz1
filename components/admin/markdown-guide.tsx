'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Texto',
    rows: [
      ['**negrito**  _itálico_  ~~riscado~~', 'Ênfase'],
      ['`código`', 'Código no meio do texto'],
      ['[texto](https://…)', 'Link'],
      ['## Título  ### Subtítulo', 'Seções (viram o índice lateral)'],
      ['> citação', 'Citação'],
      ['---', 'Divisor'],
      [':rocket: :tada:', 'Emoji'],
      ['<kbd>Ctrl</kbd>  <mark>marca</mark>  H<sub>2</sub>O', 'HTML simples também funciona'],
    ],
  },
  {
    title: 'Listas e tabelas',
    rows: [
      ['- item\n- item', 'Lista'],
      ['1. passo\n2. passo', 'Lista numerada'],
      ['- [ ] tarefa\n- [x] feita', 'Checklist'],
      ['| A | B |\n| --- | :-: |\n| 1 | 2 |', 'Tabela (":-:" centraliza)'],
    ],
  },
  {
    title: 'Mídia',
    rows: [
      ['![descrição](/foto.webp "Legenda")', 'Imagem com legenda'],
      ['![Legenda](/video.mp4)', 'Vídeo MP4/WebM'],
      ['https://youtu.be/ID', 'Link do YouTube sozinho na linha vira player'],
      ['![Legenda](https://youtu.be/ID?t=42)', 'YouTube com legenda e início'],
      [
        '![logo](docs/logo.png)  ✗',
        'Caminho relativo (de README) não existe no blog: use URL completa ou envie a imagem',
      ],
    ],
  },
  {
    title: 'Recursos extras',
    rows: [
      ['> [!TIP]\n> Dica.', 'Destaque: NOTE, TIP, IMPORTANT, WARNING, CAUTION'],
      ['Texto[^1]\n\n[^1]: A nota.', 'Nota de rodapé'],
      ['$$\nE = mc^2\n$$', 'Fórmula (LaTeX). Um $ sozinho fica como texto: R$ 10'],
      ['```ts\nconst x = 1\n```', 'Código com destaque de sintaxe'],
      ['<details>\n<summary>Título</summary>\n\nConteúdo\n\n</details>', 'Bloco expansível'],
    ],
  },
];

export function MarkdownGuide({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Guia de Markdown</DialogTitle>
          <DialogDescription>
            CommonMark + GitHub (GFM), com HTML seguro, fórmulas, notas e destaques. Digite “/” no
            texto para inserir qualquer bloco.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="mb-2 font-sans text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {section.title}
              </h3>
              <div className="overflow-hidden rounded-lg border border-border">
                {section.rows.map(([syntax, meaning]) => (
                  <div
                    key={syntax}
                    className="grid grid-cols-1 gap-1 border-b border-border/60 px-3 py-2 last:border-0 sm:grid-cols-[1fr_1fr] sm:gap-4"
                  >
                    <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                      {syntax}
                    </pre>
                    <span className="text-sm text-muted-foreground">{meaning}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
