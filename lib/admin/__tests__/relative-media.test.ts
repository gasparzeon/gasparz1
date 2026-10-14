import {
  findRelativeMedia,
  firstRelativeImage,
  guessGitHubRepo,
  isRelativeUrl,
  parseGitHubRepo,
  rewriteRelativeToGitHub,
} from '../relative-media';

// Trechos reais de um README do GitHub (GoAnime).
const README = `<p align="center">
  <b>English</b> | <a href="README_pt-br.md">Português</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <img src="docs/assets/logo-light.png" alt="GoAnime logo" width="160">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/alvarorichard/GoAnime/actions/workflows/ci.yml"><img src="https://github.com/alvarorichard/GoAnime/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/alvarorichard/GoAnime" alt="License"></a>
</p>

<img src="./docs/demo/demo.gif" alt="Demo" width="800">

See [docs/BUILD_OPTIONS.md](docs/BUILD_OPTIONS.md), [mpv](https://mpv.io/) and [Features](#features).
Inspired by [ani-cli](https://github.com/pystardust/ani-cli). Releases: https://github.com/alvarorichard/GoAnime/releases/latest

\`\`\`bash
cat docs/not-a-link.md
![nao mexer](docs/em-codigo.png)
\`\`\`

Use \`![exemplo](docs/inline.png)\` para imagens.
`;

describe('isRelativeUrl', () => {
  it.each([
    ['docs/a.png', true],
    ['./a.png', true],
    ['README.md', true],
    ['/uploads/a.png', false],
    ['https://x.com/a.png', false],
    ['//cdn.com/a.png', false],
    ['#features', false],
    ['mailto:a@b.com', false],
    ['data:image/png;base64,AAA', false],
    ['', false],
  ])('%s → %s', (url, expected) => {
    expect(isRelativeUrl(url)).toBe(expected);
  });
});

describe('findRelativeMedia', () => {
  it('encontra imagens e links relativos em Markdown e HTML, ignorando código', () => {
    const { images, links } = findRelativeMedia(README);

    expect(images.sort()).toEqual([
      './docs/demo/demo.gif',
      'docs/assets/logo-dark.png',
      'docs/assets/logo-light.png',
    ]);
    expect(links.sort()).toEqual(['LICENSE', 'README_pt-br.md', 'docs/BUILD_OPTIONS.md']);
  });

  it('não acusa nada em textos com URLs completas', () => {
    expect(findRelativeMedia('![a](https://x.com/a.png) [b](/posts/b)')).toEqual({
      images: [],
      links: [],
    });
  });
});

describe('guessGitHubRepo', () => {
  it('escolhe o repositório mais citado e ignora páginas do GitHub', () => {
    expect(guessGitHubRepo(README)).toEqual({ owner: 'alvarorichard', repo: 'GoAnime' });
    expect(guessGitHubRepo('https://github.com/sponsors/fulano')).toBeNull();
    expect(guessGitHubRepo('sem links')).toBeNull();
  });

  it('não inclui a pontuação do fim da frase no nome do repositório', () => {
    expect(guessGitHubRepo('O código está em https://github.com/dono/projeto.')).toEqual({
      owner: 'dono',
      repo: 'projeto',
    });
    expect(guessGitHubRepo('Clone https://github.com/vercel/next.js.git...')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
    });
  });
});

describe('parseGitHubRepo', () => {
  it.each([
    ['alvarorichard/GoAnime', { owner: 'alvarorichard', repo: 'GoAnime' }],
    ['https://github.com/alvarorichard/GoAnime', { owner: 'alvarorichard', repo: 'GoAnime' }],
    ['https://github.com/alvarorichard/GoAnime.git', { owner: 'alvarorichard', repo: 'GoAnime' }],
    ['alvarorichard/GoAnime@dev', { owner: 'alvarorichard', repo: 'GoAnime', ref: 'dev' }],
    [
      'https://github.com/alvarorichard/GoAnime/tree/dev',
      { owner: 'alvarorichard', repo: 'GoAnime', ref: 'dev' },
    ],
    [
      'https://github.com/alvarorichard/GoAnime/blob/v1.2.0/README.md',
      { owner: 'alvarorichard', repo: 'GoAnime', ref: 'v1.2.0' },
    ],
    ['só-texto', null],
    ['https://evil.com/a/b', null],
  ])('%s', (input, expected) => {
    expect(parseGitHubRepo(input)).toEqual(expected);
  });
});

describe('rewriteRelativeToGitHub', () => {
  const repo = { owner: 'alvarorichard', repo: 'GoAnime' };

  it('aponta imagens para raw.githubusercontent.com e links para a página do arquivo', () => {
    const { content, changed } = rewriteRelativeToGitHub(README, repo);

    expect(content).toContain(
      'src="https://raw.githubusercontent.com/alvarorichard/GoAnime/HEAD/docs/assets/logo-light.png"',
    );
    expect(content).toContain(
      'srcset="https://raw.githubusercontent.com/alvarorichard/GoAnime/HEAD/docs/assets/logo-dark.png"',
    );
    expect(content).toContain(
      'src="https://raw.githubusercontent.com/alvarorichard/GoAnime/HEAD/docs/demo/demo.gif"',
    );
    expect(content).toContain(
      '[docs/BUILD_OPTIONS.md](https://github.com/alvarorichard/GoAnime/blob/HEAD/docs/BUILD_OPTIONS.md)',
    );
    expect(content).toContain('href="https://github.com/alvarorichard/GoAnime/blob/HEAD/LICENSE"');
    expect(changed).toBe(6);
  });

  it('não mexe em URLs completas, âncoras nem em código', () => {
    const { content } = rewriteRelativeToGitHub(README, repo);

    expect(content).toContain('[mpv](https://mpv.io/)');
    expect(content).toContain('[Features](#features)');
    expect(content).toContain('![nao mexer](docs/em-codigo.png)');
    expect(content).toContain('`![exemplo](docs/inline.png)`');
    expect(findRelativeMedia(content)).toEqual({ images: [], links: [] });
  });

  it('deixa caminhos com ../ como estão e aceita outro ref', () => {
    const { content, changed } = rewriteRelativeToGitHub('![a](../a.png) ![b](b.png)', repo, {
      images: 'dev',
    });
    expect(content).toBe(
      '![a](../a.png) ![b](https://raw.githubusercontent.com/alvarorichard/GoAnime/dev/b.png)',
    );
    expect(changed).toBe(1);
  });

  it('fixa as imagens num commit e mantém os links no branch', () => {
    const { content } = rewriteRelativeToGitHub('![a](a.png) [doc](docs/x.md)', repo, {
      images: 'ae3251e',
      links: 'dev',
    });
    expect(content).toBe(
      '![a](https://raw.githubusercontent.com/alvarorichard/GoAnime/ae3251e/a.png) [doc](https://github.com/alvarorichard/GoAnime/blob/dev/docs/x.md)',
    );
  });
});

describe('firstRelativeImage', () => {
  it('devolve a primeira imagem resolvível, sem "./" e pulando "../"', () => {
    expect(firstRelativeImage('![a](../a.png) ![b](./docs/b.png)')).toBe('docs/b.png');
    expect(firstRelativeImage('![a](https://x.com/a.png) [b](b.md)')).toBeNull();
  });
});
