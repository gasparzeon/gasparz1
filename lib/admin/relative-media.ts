// Caminhos relativos ("docs/logo.png") funcionam dentro de um repositório
// do GitHub, mas no blog apontariam para /posts/docs/logo.png (404). Isso é
// comum ao colar um README: aqui detectamos e reescrevemos para o GitHub.

export type GitHubRepo = { owner: string; repo: string };

// Tem esquema (https:, mailto:, data:…), é absoluto (/) ou âncora (#).
const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

export function isRelativeUrl(url: string) {
  const value = url.trim();
  return value !== '' && !NOT_RELATIVE.test(value);
}

// O resto até o ")" (título incluso) é capturado por [^)]*: sem
// quantificadores aninhados, casamento linear.
const MD_IMAGE = /(!\[[^\]]*\]\(\s*<?)([^)\s>]+)(>?[^)]*\))/g;
const MD_LINK = /((?<!!)\[[^\]]*\]\(\s*<?)([^)\s>]+)(>?[^)]*\))/g;
const HTML_SRC = /(<(?:img|source|video)\b[^>]*?\s(?:src|poster)\s*=\s*["'])([^"']+)(["'])/gi;
const HTML_SRCSET = /(\ssrcset\s*=\s*["'])([^"']+)(["'])/gi;
const HTML_HREF = /(<a\b[^>]*?\shref\s*=\s*["'])([^"']+)(["'])/gi;

// Aplica `fn` só fora de blocos e trechos de código.
function outsideCode(markdown: string, fn: (text: string) => string) {
  return markdown
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
    .map((part, index) => (index % 2 === 1 ? part : fn(part)))
    .join('');
}

function srcsetUrls(srcset: string) {
  return srcset
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

export function findRelativeMedia(markdown: string) {
  const images = new Set<string>();
  const links = new Set<string>();

  outsideCode(markdown, (text) => {
    for (const match of text.matchAll(MD_IMAGE)) if (isRelativeUrl(match[2])) images.add(match[2]);
    for (const match of text.matchAll(HTML_SRC)) if (isRelativeUrl(match[2])) images.add(match[2]);
    for (const match of text.matchAll(HTML_SRCSET)) {
      srcsetUrls(match[2])
        .filter(isRelativeUrl)
        .forEach((url) => images.add(url));
    }
    for (const match of text.matchAll(MD_LINK)) if (isRelativeUrl(match[2])) links.add(match[2]);
    for (const match of text.matchAll(HTML_HREF)) if (isRelativeUrl(match[2])) links.add(match[2]);
    return text;
  });

  return { images: Array.from(images), links: Array.from(links) };
}

// Páginas do próprio GitHub que não são repositórios.
const RESERVED_OWNERS = new Set([
  'about',
  'apps',
  'collections',
  'explore',
  'features',
  'login',
  'marketplace',
  'notifications',
  'orgs',
  'pricing',
  'settings',
  'sponsors',
  'topics',
  'trending',
  'users',
]);

// O repositório mais citado no texto (um README costuma linkar o próprio).
export function guessGitHubRepo(markdown: string): GitHubRepo | null {
  const counts = new Map<string, { repo: GitHubRepo; total: number }>();
  const pattern =
    /https?:\/\/(?:www\.)?(?:github\.com|raw\.githubusercontent\.com)\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})/g;

  for (const match of markdown.matchAll(pattern)) {
    const owner = match[1];
    // O ponto final de uma frase ("…em github.com/dono/repo.") não é do nome.
    const repo = match[2].replace(/\.+$/, '').replace(/\.git$/, '');
    if (RESERVED_OWNERS.has(owner.toLowerCase()) || !repo) continue;

    const key = `${owner}/${repo}`.toLowerCase();
    const entry = counts.get(key) ?? { repo: { owner, repo }, total: 0 };
    entry.total += 1;
    counts.set(key, entry);
  }

  let best: { repo: GitHubRepo; total: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.total > best.total) best = entry;
  }
  return best?.repo ?? null;
}

// Aceita "dono/repo", "dono/repo@branch", a URL do repositório ou de uma
// pasta/arquivo nele (".../tree/dev", ".../blob/dev/README.md").
const OWNER = /^[A-Za-z0-9-]{1,39}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const REF = /^[\w.-]{1,100}$/;

export function parseGitHubRepo(input: string): (GitHubRepo & { ref?: string }) | null {
  const value = input
    .trim()
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, '')
    .replace(/\/+$/, '');

  const [path, atRef] = value.split('@');
  const [owner = '', name = '', kind, treeRef] = path.split('/');
  const repo = name.replace(/\.git$/, '');
  if (!OWNER.test(owner) || !REPO.test(repo)) return null;

  // Depois de dono/repo só vale "@ref" ou "/tree/<ref>" e "/blob/<ref>/…".
  if (kind !== undefined && !((kind === 'tree' || kind === 'blob') && treeRef)) return null;

  const ref = atRef ?? treeRef;
  if (ref === undefined) return { owner, repo };
  return REF.test(ref) ? { owner, repo, ref } : null;
}

// "./docs/a.png" → "docs/a.png". Caminhos com "../" não têm como ser
// resolvidos sem saber onde o arquivo original estava: ficam como estão.
function cleanPath(path: string) {
  const value = path.trim().replace(/^(\.\/)+/, '');
  return value.startsWith('../') ? null : value;
}

// Primeira imagem relativa que dá para resolver: usada para descobrir o branch.
export function firstRelativeImage(markdown: string) {
  for (const image of findRelativeMedia(markdown).images) {
    const clean = cleanPath(image);
    if (clean) return clean;
  }
  return null;
}

// Imagens viram raw.githubusercontent.com e links, a página do arquivo.
// `refs.images` costuma ser um commit (permanente); `refs.links`, o branch.
export function rewriteRelativeToGitHub(
  markdown: string,
  { owner, repo }: GitHubRepo,
  refs: { images?: string; links?: string } = {},
) {
  const imageRef = refs.images ?? 'HEAD';
  const linkRef = refs.links ?? imageRef;
  let changed = 0;

  const raw = (path: string) => {
    const clean = isRelativeUrl(path) ? cleanPath(path) : null;
    if (clean === null) return path;
    changed += 1;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${imageRef}/${clean}`;
  };

  const page = (path: string) => {
    const clean = isRelativeUrl(path) ? cleanPath(path) : null;
    if (clean === null) return path;
    changed += 1;
    return `https://github.com/${owner}/${repo}/blob/${linkRef}/${clean}`;
  };

  const content = outsideCode(markdown, (text) =>
    text
      .replace(MD_IMAGE, (_all, start: string, url: string, end: string) => start + raw(url) + end)
      .replace(HTML_SRC, (_all, start: string, url: string, end: string) => start + raw(url) + end)
      .replace(
        HTML_SRCSET,
        (_all, start: string, srcset: string, end: string) =>
          start +
          srcset
            .split(',')
            .map((candidate) =>
              candidate.replace(
                /^(\s*)(\S+)/,
                (_m, space: string, url: string) => space + raw(url),
              ),
            )
            .join(',') +
          end,
      )
      .replace(MD_LINK, (_all, start: string, url: string, end: string) => start + page(url) + end)
      .replace(
        HTML_HREF,
        (_all, start: string, url: string, end: string) => start + page(url) + end,
      ),
  );

  return { content, changed };
}
