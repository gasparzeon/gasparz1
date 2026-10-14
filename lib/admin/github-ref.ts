// Descobre em qual branch de um repositório público do GitHub as imagens de
// um README existem. O README colado pode vir de um branch que não é o
// padrão (ex.: "dev"), e aí raw.githubusercontent.com/<dono>/<repo>/HEAD/…
// dá 404. Tanto a API quanto o raw.githubusercontent.com liberam CORS.

import type { GitHubRepo } from './relative-media';

export type GitHubBranch = { name: string; sha: string };

export type ResolvedRef = {
  // Nome do branch (ou o ref digitado): usado nos links, que acompanham o branch.
  name: string;
  // Commit atual do branch: as imagens ficam fixadas nele e não quebram se o
  // arquivo for movido ou apagado depois. Sem a API, fica igual a `name`.
  pinned: string;
};

const API = 'https://api.github.com';
const MAX_BRANCHES = 15;
const TIMEOUT_MS = 8000;

export function rawGitHubUrl({ owner, repo }: GitHubRepo, ref: string, path: string) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

// HEAD não baixa o arquivo (um GIF de demonstração pode ter vários MB).
export async function fileExists(url: string) {
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// Branches com o padrão primeiro. null quando a API não responde (offline,
// repositório privado ou limite de 60 requisições/hora sem login).
export async function listBranches({ owner, repo }: GitHubRepo): Promise<GitHubBranch[] | null> {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const [info, branches] = await Promise.all([
    getJson<{ default_branch?: string }>(base),
    getJson<{ name: string; commit: { sha: string } }[]>(`${base}/branches?per_page=100`),
  ]);
  if (!Array.isArray(branches)) return null;

  const list = branches.map((branch) => ({ name: branch.name, sha: branch.commit.sha }));
  const main = info?.default_branch;
  return [
    ...list.filter((branch) => branch.name === main),
    ...list.filter((branch) => branch.name !== main),
  ];
}

// Primeiro ref em que `probePath` existe. Com `preferred` (digitado pela
// pessoa), só ele é testado; sem, o branch padrão e depois os demais.
export async function resolveRef(
  repo: GitHubRepo,
  probePath: string,
  preferred?: string,
): Promise<ResolvedRef | null> {
  const branches = await listBranches(repo);

  let candidates: ResolvedRef[];
  if (preferred) {
    const branch = branches?.find((item) => item.name === preferred);
    candidates = [{ name: preferred, pinned: branch?.sha ?? preferred }];
  } else if (branches && branches.length > 0) {
    candidates = branches
      .slice(0, MAX_BRANCHES)
      .map((branch) => ({ name: branch.name, pinned: branch.sha }));
  } else {
    candidates = [{ name: 'HEAD', pinned: 'HEAD' }];
  }

  for (const candidate of candidates) {
    if (await fileExists(rawGitHubUrl(repo, candidate.pinned, probePath))) return candidate;
  }
  return null;
}
