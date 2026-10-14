import { fileExists, listBranches, rawGitHubUrl, resolveRef } from '../github-ref';

const repo = { owner: 'alvarorichard', repo: 'GoAnime' };
const mockFetch = jest.fn();

const json = (body: unknown, ok = true) => ({ ok, json: async () => body });

// API do GitHub: "main" é o padrão, mas a imagem só existe em "dev".
function github({ files = [] as string[], apiDown = false } = {}) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return { ok: files.includes(url) };
    if (apiDown) throw new TypeError('Failed to fetch');
    if (url.endsWith('/branches?per_page=100')) {
      return json([
        { name: 'dev', commit: { sha: 'ae3251eb55f7' } },
        { name: 'main', commit: { sha: '85258f7b4830' } },
      ]);
    }
    if (url.endsWith('/repos/alvarorichard/GoAnime')) return json({ default_branch: 'main' });
    return json({ message: 'Not Found' }, false);
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('rawGitHubUrl', () => {
  it('monta a URL do raw.githubusercontent.com', () => {
    expect(rawGitHubUrl(repo, 'dev', 'docs/a.png')).toBe(
      'https://raw.githubusercontent.com/alvarorichard/GoAnime/dev/docs/a.png',
    );
  });
});

describe('fileExists', () => {
  it('usa HEAD (não baixa o arquivo) e trata erro de rede como inexistente', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(fileExists('https://x/a.gif')).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://x/a.gif',
      expect.objectContaining({ method: 'HEAD' }),
    );

    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(fileExists('https://x/a.gif')).resolves.toBe(false);
  });
});

describe('listBranches', () => {
  it('coloca o branch padrão primeiro', async () => {
    github();
    await expect(listBranches(repo)).resolves.toEqual([
      { name: 'main', sha: '85258f7b4830' },
      { name: 'dev', sha: 'ae3251eb55f7' },
    ]);
  });

  it('devolve null quando a API não responde', async () => {
    github({ apiDown: true });
    await expect(listBranches(repo)).resolves.toBeNull();
  });
});

describe('resolveRef', () => {
  const probe = 'docs/assets/logo-light.png';

  it('acha o branch em que a imagem existe e fixa no commit', async () => {
    github({ files: [rawGitHubUrl(repo, 'ae3251eb55f7', probe)] });
    await expect(resolveRef(repo, probe)).resolves.toEqual({
      name: 'dev',
      pinned: 'ae3251eb55f7',
    });
  });

  it('testa só o branch pedido quando ele é informado', async () => {
    github({ files: [rawGitHubUrl(repo, 'ae3251eb55f7', probe)] });
    await expect(resolveRef(repo, probe, 'main')).resolves.toBeNull();
    await expect(resolveRef(repo, probe, 'dev')).resolves.toEqual({
      name: 'dev',
      pinned: 'ae3251eb55f7',
    });
  });

  it('sem a API, ainda tenta o branch padrão (HEAD)', async () => {
    github({ apiDown: true, files: [rawGitHubUrl(repo, 'HEAD', probe)] });
    await expect(resolveRef(repo, probe)).resolves.toEqual({ name: 'HEAD', pinned: 'HEAD' });
  });

  it('devolve null quando a imagem não existe em nenhum branch', async () => {
    github();
    await expect(resolveRef(repo, probe)).resolves.toBeNull();
  });
});
