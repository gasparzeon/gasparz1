'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';

import { resolveRef, type ResolvedRef } from '@/lib/admin/github-ref';
import {
  findRelativeMedia,
  firstRelativeImage,
  guessGitHubRepo,
  parseGitHubRepo,
  rewriteRelativeToGitHub,
  type GitHubRepo,
} from '@/lib/admin/relative-media';
import { Button } from '@/components/ui/button';

interface RelativeMediaNoticeProps {
  content: string;
  onFix: (content: string, changed: number, repo: GitHubRepo, ref: ResolvedRef) => void;
}

// Avisa quando o texto (normalmente um README colado do GitHub) tem imagens
// ou links com caminho relativo, que no blog dariam 404, e corrige com um
// clique depois de achar o branch em que as imagens existem de verdade.
export function RelativeMediaNotice({ content, onFix }: RelativeMediaNoticeProps) {
  const deferred = useDeferredValue(content);
  const found = useMemo(() => findRelativeMedia(deferred), [deferred]);
  const guessed = useMemo(() => guessGitHubRepo(deferred), [deferred]);
  const signature = JSON.stringify(found);

  const [dismissed, setDismissed] = useState<string | null>(null);
  const [repoText, setRepoText] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = found.images.length + found.links.length;
  if (total === 0 || dismissed === signature) return null;

  const value = repoText ?? (guessed ? `${guessed.owner}/${guessed.repo}` : '');
  const repo = parseGitHubRepo(value);
  const example = found.images[0] ?? found.links[0];

  const parts = [
    found.images.length > 0 &&
      `${found.images.length} ${found.images.length === 1 ? 'imagem' : 'imagens'}`,
    found.links.length > 0 &&
      `${found.links.length} ${found.links.length === 1 ? 'link' : 'links'}`,
  ].filter(Boolean);

  async function fix(target: GitHubRepo & { ref?: string }) {
    setError(null);
    const probe = firstRelativeImage(content);

    let ref: ResolvedRef = { name: target.ref ?? 'HEAD', pinned: target.ref ?? 'HEAD' };
    if (probe) {
      setChecking(true);
      const resolved = await resolveRef(target, probe, target.ref);
      setChecking(false);
      if (!resolved) {
        const where = target.ref ? `no branch ${target.ref}` : 'em nenhum branch';
        setError(
          `Não encontrei ${probe} ${where} de ${target.owner}/${target.repo}. Confira o repositório (ex.: dono/repo@dev) ou envie as imagens pela biblioteca.`,
        );
        return;
      }
      ref = resolved;
    }

    const result = rewriteRelativeToGitHub(content, target, {
      images: ref.pinned,
      links: ref.name,
    });
    onFix(result.content, result.changed, target, ref);
  }

  return (
    <div className="border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ImageOff className="h-4 w-4 shrink-0 text-yellow-700 dark:text-yellow-400" />
        <span className="min-w-0 text-muted-foreground">
          {parts.join(' e ')} com caminho relativo (ex.:{' '}
          <code className="text-foreground">{example}</code>
          ). Eles só existem no repositório original, não no blog.
        </span>

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (repo && !checking) void fix(repo);
          }}
        >
          <input
            value={value}
            onChange={(event) => {
              setRepoText(event.target.value);
              setError(null);
            }}
            placeholder="dono/repositório (ou dono/repo@branch)"
            aria-label="Repositório do GitHub de onde o texto veio"
            spellCheck={false}
            className="h-7 w-64 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:border-ring dark:bg-input/30"
          />
          <Button type="submit" size="sm" className="h-7" disabled={!repo || checking}>
            {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {checking ? 'Procurando…' : 'Apontar para o GitHub'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => setDismissed(signature)}
          >
            Ignorar
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
