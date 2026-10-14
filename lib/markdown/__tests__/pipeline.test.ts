import { renderToStaticMarkup } from 'react-dom/server';

import { renderMarkdownTree } from '@/components/markdown/render';

import { markdownToHast, stripPositions } from '../pipeline';

// Pipeline real (remark/rehype/Shiki/KaTeX), renderizado como no site.
async function html(markdown: string) {
  return renderToStaticMarkup(renderMarkdownTree(await markdownToHast(markdown)));
}

describe('segurança: HTML de autores é sanitizado', () => {
  it.each([
    ['<script>', '<script>alert(1)</script>', /<script|alert\(1\)/],
    ['handler on*', '<img src="/a.png" onerror="alert(1)">', /onerror/i],
    ['link javascript:', '<a href="javascript:alert(1)">x</a>', /javascript:/i],
    ['link markdown javascript:', '[x](javascript:alert(1))', /javascript:/i],
    ['iframe', '<iframe src="https://evil.example"></iframe>', /<iframe/],
    ['style inline', '<p style="position:fixed;inset:0">x</p>', /position:fixed/],
    ['<style>', '<style>body{display:none}</style>', /display:none/],
    ['form', '<form action="https://evil.example"><input name="senha"></form>', /<form|evil/],
    ['svg com script', '<svg onload="alert(1)"><script>alert(2)</script></svg>', /onload|alert/],
    ['imagem data:', '![x](data:image/svg+xml;base64,PHN2Zz4=)', /data:image/],
  ])('remove %s', async (_label, input, forbidden) => {
    expect(await html(input)).not.toMatch(forbidden);
  });

  it('mantém o HTML seguro do dia a dia', async () => {
    const out = await html(
      '<kbd>Ctrl</kbd> <mark>marca</mark> H<sub>2</sub>O x<sup>2</sup> <abbr title="Brasil">BR</abbr>',
    );
    expect(out).toContain('<kbd>Ctrl</kbd>');
    expect(out).toContain('<mark>marca</mark>');
    expect(out).toContain('<sub>2</sub>');
    expect(out).toContain('<abbr title="Brasil">BR</abbr>');
  });
});

describe('Markdown completo', () => {
  it('suporta GFM: tabelas com alinhamento, checklists, riscado e autolinks', async () => {
    const out = await html(
      '| A | B |\n| --- | :-: |\n| 1 | 2 |\n\n- [x] feito\n- [ ] pendente\n\n~~velho~~ www.example.com',
    );
    expect(out).toContain('<div class="md-table"><table>');
    expect(out).toContain('style="text-align:center"');
    // Checklist sem caixa de seleção sem rótulo: marca visual + texto para leitores de tela.
    expect(out).not.toContain('<input');
    expect(out).toContain(
      '<span class="task-mark" data-done="true" aria-hidden="true"></span><span class="sr-only">Feito:</span> feito',
    );
    expect(out).toContain('data-done="false"');
    expect(out).toContain('<span class="sr-only">A fazer:</span> pendente');
    expect(out).toContain('<del>velho</del>');
    expect(out).toContain('href="http://www.example.com"');
  });

  it('gera notas de rodapé com links de ida e volta consistentes', async () => {
    const out = await html('Texto[^1].\n\n[^1]: A nota.');
    expect(out).toContain('href="#user-content-fn-1"');
    expect(out).toContain('id="user-content-fn-1"');
    expect(out).toContain('id="user-content-fnref-1"');
    expect(out).toContain('href="#user-content-fnref-1"');
    expect(out).toContain('aria-label="Voltar ao texto"');
  });

  it('renderiza fórmulas com $$ e deixa valores em reais como texto', async () => {
    const out = await html('Custa R$ 10 e R$ 20.\n\n$$\nE = mc^2\n$$');
    expect(out).toContain('Custa R$ 10 e R$ 20.');
    expect(out).toContain('class="katex-display"');
    expect(out).toContain('<annotation encoding="application/x-tex">E = mc^2</annotation>');
  });

  it('destaca código com Shiki (tema claro e escuro) e mantém linguagens desconhecidas', async () => {
    const out = await html('```ts\nconst x = 1\n```\n\n```linguagem-inventada\nabc\n```');
    expect(out).toContain('data-language="ts"');
    expect(out).toContain('--shiki-dark');
    expect(out).toContain('--shiki-light');
    expect(out).toContain('abc');
    expect(out).toContain('aria-label="Copiar código"');
  });

  it('converte alertas do GitHub em destaques', async () => {
    const out = await html('> [!WARNING]\n> Cuidado com **isto**.\n\n> citação normal');
    expect(out).toContain('Atenção');
    expect(out).toContain('<strong>isto</strong>');
    expect(out).not.toContain('[!WARNING]');
    expect(out).toContain('<blockquote>');
  });

  it('cria âncoras nos títulos e converte emojis', async () => {
    const out = await html('## Olá mundo :rocket:');
    // Como no GitHub, o emoji fica no texto mas sai do id.
    expect(out).toMatch(/<h2 id="olá-mundo-">Olá mundo 🚀<a class="heading-anchor"/);
  });

  it('mantém <details> expansível', async () => {
    const out = await html('<details><summary>Mais</summary>\n\nEscondido\n\n</details>');
    expect(out).toContain('<details><summary>Mais</summary>');
  });

  it('abre links externos em nova aba com rel seguro', async () => {
    const out = await html('[fora](https://example.com) e [dentro](/posts/x)');
    expect(out).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
    expect(out).toContain('href="/posts/x">dentro');
  });
});

describe('mídia', () => {
  it('imagem sozinha vira figura com legenda (título) e carregamento preguiçoso', async () => {
    const out = await html('![Uma foto](/uploads/a.png "Legenda da foto")');
    expect(out).toContain('<figure class="md-figure"><img src="/uploads/a.png" alt="Uma foto"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('<figcaption>Legenda da foto</figcaption>');
  });

  it('imagem apontando para vídeo vira player', async () => {
    const out = await html('![Clipe](/uploads/clip.mp4)');
    expect(out).toMatch(/<video src="\/uploads\/clip.mp4" controls="" playsInline=""/);
    expect(out).toContain('<figcaption>Clipe</figcaption>');
  });

  it('<video> em HTML aceita miniatura (poster), mas não reprodução automática', async () => {
    const out = await html(
      '<video src="/uploads/clip.mp4" poster="/uploads/capa.webp" controls autoplay></video>',
    );
    expect(out).toContain('poster="/uploads/capa.webp"');
    expect(out).toContain('controls');
    expect(out).not.toMatch(/autoplay/i);
  });

  it('link do YouTube sozinho na linha vira o embed leve (sem iframe até o clique)', async () => {
    const out = await html('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42');
    expect(out).toContain('i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(out).not.toContain('<iframe');
  });

  it('YouTube com legenda usa a sintaxe de imagem; no meio do texto continua link', async () => {
    const out = await html(
      '![Um clássico](https://youtu.be/dQw4w9WgXcQ)\n\nVeja https://youtu.be/dQw4w9WgXcQ agora.',
    );
    expect(out).toContain('<figcaption>Um clássico</figcaption>');
    expect(out).toContain('href="https://youtu.be/dQw4w9WgXcQ"');
  });
});

describe('stripPositions', () => {
  it('remove posições e metadados antes de enviar a árvore ao navegador', async () => {
    const tree = stripPositions(await markdownToHast('# Oi'));
    expect(JSON.stringify(tree)).not.toMatch(/"position"|"data"/);
  });
});
