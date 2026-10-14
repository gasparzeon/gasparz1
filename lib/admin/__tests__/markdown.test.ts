import {
  altFromFileName,
  codeBlock,
  footnote,
  imageMarkdown,
  insertBlock,
  link,
  toggleLineStyle,
  videoMarkdown,
  wrap,
  youtubeMarkdown,
  type Edit,
} from '../markdown';

// Aplica a edição e marca a seleção final com « » para asserções legíveis.
function apply(value: string, edit: Edit) {
  const next = value.slice(0, edit.from) + edit.insert + value.slice(edit.to);
  const [start, end] = edit.selection;
  return next.slice(0, start) + '«' + next.slice(start, end) + '»' + next.slice(end);
}

// Monta a seleção a partir de um texto com « » marcando o trecho selecionado.
function sel(marked: string) {
  const start = marked.indexOf('«');
  const end = marked.indexOf('»') - 1;
  return { value: marked.replace('«', '').replace('»', ''), start, end };
}

function run(marked: string, fn: (s: ReturnType<typeof sel>) => Edit) {
  const selection = sel(marked);
  return apply(selection.value, fn(selection));
}

describe('wrap', () => {
  it('envolve a seleção', () => {
    expect(run('Olá «mundo»!', (s) => wrap(s, '**', '**', 'x'))).toBe('Olá **«mundo»**!');
  });

  it('insere placeholder selecionado quando não há seleção', () => {
    expect(run('Olá «»', (s) => wrap(s, '_', '_', 'itálico'))).toBe('Olá _«itálico»_');
  });

  it('desfaz quando já está envolvido (por fora ou por dentro da seleção)', () => {
    expect(run('Olá **«mundo»**!', (s) => wrap(s, '**', '**', 'x'))).toBe('Olá «mundo»!');
    expect(run('Olá «**mundo**»!', (s) => wrap(s, '**', '**', 'x'))).toBe('Olá «mundo»!');
  });
});

describe('toggleLineStyle', () => {
  it('aplica título e troca outro prefixo de bloco', () => {
    expect(run('Introdu«»ção', (s) => toggleLineStyle(s, 'h2'))).toBe('## Introdução«»');
    expect(run('## Introdu«»ção', (s) => toggleLineStyle(s, 'h3'))).toBe('### Introdução«»');
    expect(run('- item«»', (s) => toggleLineStyle(s, 'quote'))).toBe('> item«»');
  });

  it('remove o estilo quando todas as linhas já o têm', () => {
    expect(run('## Título«»', (s) => toggleLineStyle(s, 'h2'))).toBe('Título«»');
  });

  it('numera listas ordenadas e ignora linhas vazias', () => {
    expect(run('«um\ndois\n\ntrês»', (s) => toggleLineStyle(s, 'ol'))).toBe(
      '«1. um\n2. dois\n\n3. três»',
    );
  });

  it('converte lista em checklist e volta', () => {
    expect(run('«- a\n- b»', (s) => toggleLineStyle(s, 'task'))).toBe('«- [ ] a\n- [ ] b»');
    expect(run('«- [ ] a\n- [x] b»', (s) => toggleLineStyle(s, 'ul'))).toBe('«- a\n- b»');
  });
});

describe('insertBlock', () => {
  it('garante linha em branco antes e depois', () => {
    expect(run('texto«»', (s) => insertBlock(s, '---'))).toBe('texto\n\n---\n\n«»');
    expect(run('a\n\n«»\n\nb', (s) => insertBlock(s, '---'))).toBe('a\n\n---\n\n«»\n\nb');
    expect(run('a«»\nb', (s) => insertBlock(s, '---'))).toBe('a\n\n---\n\n«»\n\nb');
    expect(run('a«» b', (s) => insertBlock(s, '---'))).toBe('a\n\n---\n\n«»\n\n b');
  });

  it('não adiciona linhas no início do documento', () => {
    expect(run('«»', (s) => insertBlock(s, '---'))).toBe('---\n\n«»');
  });

  it('seleciona o trecho pedido dentro do bloco', () => {
    expect(run('«»', (s) => codeBlock(s))).toBe('```\n«código»\n```\n\n');
  });
});

describe('link', () => {
  it('transforma texto selecionado em link com a URL selecionada', () => {
    expect(run('veja «isto»', (s) => link(s))).toBe('veja [isto](«https://»)');
  });

  it('usa a seleção como URL quando ela já é uma URL', () => {
    expect(run('«https://a.com»', (s) => link(s))).toBe('[«texto do link»](https://a.com)');
  });
});

describe('snippets de mídia', () => {
  it('escapa texto alternativo, legenda e URL da imagem', () => {
    expect(imageMarkdown('/a b(1).png', 'foto [x]', 'Legenda "boa"')).toBe(
      '![foto \\[x\\]](/a%20b%281%29.png "Legenda \\"boa\\"")',
    );
    expect(imageMarkdown('/a.png', '')).toBe('![](/a.png)');
  });

  it('vídeo e YouTube usam Markdown puro (sintaxe de imagem ou link)', () => {
    expect(videoMarkdown('/v.mp4', 'Clipe [1]')).toBe('![Clipe \\[1\\]](/v.mp4)');
    expect(videoMarkdown('/v.mp4')).toBe('![](/v.mp4)');
    expect(youtubeMarkdown('dQw4w9WgXcQ', 42)).toBe('https://youtu.be/dQw4w9WgXcQ?t=42');
    expect(youtubeMarkdown('dQw4w9WgXcQ', undefined, 'Legenda')).toBe(
      '![Legenda](https://youtu.be/dQw4w9WgXcQ)',
    );
  });

  it('gera texto alternativo a partir do nome do arquivo', () => {
    expect(altFromFileName('foto_da-praia--2026.final.jpg')).toBe('foto da praia 2026.final');
  });
});

describe('footnote', () => {
  it('insere a referência após a seleção e a definição no fim, selecionando o texto da nota', () => {
    expect(run('Texto «importante» aqui.', (s) => footnote(s))).toBe(
      'Texto importante[^1] aqui.\n\n[^1]: «Texto da nota.»',
    );
  });

  it('usa o próximo número livre', () => {
    expect(run('A[^1] e B«»\n\n[^1]: Primeira.\n', (s) => footnote(s))).toBe(
      'A[^1] e B[^2]\n\n[^1]: Primeira.\n\n[^2]: «Texto da nota.»',
    );
  });
});
