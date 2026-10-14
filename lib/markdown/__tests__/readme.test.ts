import { renderToStaticMarkup } from 'react-dom/server';

import { ReadmeView } from '@/components/site/readme';

import { readmeToHast } from '../readme';

// Pipeline real do README, renderizado como na página de autor.
async function html(markdown: string) {
  return renderToStaticMarkup(ReadmeView({ tree: await readmeToHast(markdown) }));
}

describe('README: o que entra', () => {
  it('títulos rebaixados dois níveis (# vira h3), sem ids nem âncoras', async () => {
    const out = await html('# Sobre mim\n\n## Interesses\n\n#### Fundo');
    expect(out).toContain('<h3>Sobre mim</h3>');
    expect(out).toContain('<h4>Interesses</h4>');
    expect(out).toContain('<h6>Fundo</h6>');
    expect(out).not.toMatch(/<h[12]|id=/);
  });

  it('listas, ênfase, código, citação e divisória', async () => {
    const out = await html(
      '- **segurança** e _privacidade_\n- ~~nada~~ `nmap`\n\n1. um\n\n> citação\n\n---\n\n```\ncódigo\n```',
    );
    expect(out).toContain('<strong>segurança</strong>');
    expect(out).toContain('<em>privacidade</em>');
    expect(out).toContain('<del>nada</del>');
    expect(out).toContain('<code>nmap</code>');
    expect(out).toContain('<ol>');
    expect(out).toContain('<blockquote>');
    expect(out).toContain('<hr/>');
    expect(out).toContain('<pre><code>código\n</code></pre>');
  });

  it('caixas de seleção (lista de tarefas) e emoji', async () => {
    const out = await html('- [x] feito\n- [ ] a fazer\n\n:rocket:');
    // Sem campo de formulário sem rótulo: marca visual + texto para leitores de tela.
    expect(out).not.toContain('<input');
    expect(out).toContain(
      '<span class="task-mark" data-done="true" aria-hidden="true"></span><span class="sr-only">Feito:</span> feito',
    );
    expect(out).toContain('<span class="sr-only">A fazer:</span> a fazer');
    expect(out).toContain('contains-task-list');
    expect(out).toContain('🚀');
  });

  it('links (http, https, mailto) com rel de conteúdo de usuário', async () => {
    const out = await html('[site](https://gaspar.dev) e [mail](mailto:oi@gaspar.dev)');
    expect(out).toContain(
      '<a href="https://gaspar.dev" rel="nofollow ugc noopener noreferrer">site</a>',
    );
    expect(out).toContain('href="mailto:oi@gaspar.dev"');
  });
});

describe('README: o que não entra', () => {
  it.each([
    ['<script>', '<script>alert(1)</script>', /<script|alert\(1\)/],
    [
      'HTML embutido',
      '<b onclick="x()">oi</b> <iframe src="https://evil.example"></iframe>',
      /<b|onclick|iframe|evil/,
    ],
    ['link javascript:', '[x](javascript:alert(1))', /javascript:/],
    ['link data:', '[x](data:text/html,oi)', /data:/],
    ['imagem (pixel de rastreio)', '![x](https://tracker.example/p.gif)', /<img|tracker/],
    ['tabela', '| a | b |\n|---|---|\n| 1 | 2 |', /<table/],
    ['estilo inline', '<p style="position:fixed">x</p>', /style=/],
  ])('remove %s', async (_label, input, forbidden) => {
    expect(await html(input)).not.toMatch(forbidden);
  });
});
