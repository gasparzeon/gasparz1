'use client';

import { useState } from 'react';
import type { Root } from 'hast';
import { FileText } from 'lucide-react';

import { adminFetch } from '@/lib/admin/client';
import {
  README_MAX_CHARS,
  README_MAX_LINES,
  README_TEMPLATE,
  readmeLines,
} from '@/lib/users/readme';
import { cn } from '@/lib/utils';
import { ReadmeView } from '@/components/site/readme';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const fmt = (value: number) => value.toLocaleString('pt-BR');

// Para leitores de tela: avisa só quando muda de faixa, não a cada tecla.
function remainingNotice(remaining: number) {
  if (remaining <= 0) return 'Limite de caracteres do README atingido.';
  if (remaining <= 50) return 'Faltam menos de 50 caracteres no README.';
  if (remaining <= 100) return 'Faltam menos de 100 caracteres no README.';
  return '';
}

type Preview = { tree: Root } | { error: string } | 'loading' | null;

// README do perfil: Markdown curto com prévia igual à da página de autor.
export function ReadmeField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const [tab, setTab] = useState('escrever');
  const [preview, setPreview] = useState<Preview>(null);

  const chars = value.length;
  const lines = readmeLines(value);
  const remaining = README_MAX_CHARS - chars;
  const describedBy = ['readme-ajuda', 'readme-contador', error ? 'readme-erro' : '']
    .filter(Boolean)
    .join(' ');

  const showPreview = async () => {
    setPreview('loading');
    try {
      const { tree } = await adminFetch<{ tree: Root }>('/api/admin/preview', {
        method: 'POST',
        body: JSON.stringify({ content: value, kind: 'readme' }),
      });
      setPreview({ tree });
    } catch (problem) {
      setPreview({ error: (problem as Error).message });
    }
  };

  return (
    <section id="readme" aria-labelledby="readme-titulo" className="scroll-mt-24 space-y-3">
      <div>
        <h2 id="readme-titulo" className="font-sans text-base font-semibold tracking-normal">
          README
        </h2>
        <p id="readme-ajuda" className="text-sm text-muted-foreground">
          Aparece na sua página de autor, antes dos seus posts. Conte o que quiser: o que você
          pesquisa, interesses, ferramentas, no que está trabalhando. Markdown curto (títulos,
          listas, links, negrito, código), sem imagens nem HTML: até {fmt(README_MAX_CHARS)}{' '}
          caracteres e {README_MAX_LINES} linhas.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next);
          if (next === 'visualizar') void showPreview();
        }}
      >
        <TabsList aria-label="README">
          <TabsTrigger value="escrever">Escrever</TabsTrigger>
          <TabsTrigger value="visualizar">Visualizar</TabsTrigger>
        </TabsList>

        <TabsContent value="escrever" className="space-y-2">
          <Label htmlFor="profile-readme" className="sr-only">
            README em Markdown
          </Label>
          <Textarea
            id="profile-readme"
            rows={10}
            maxLength={README_MAX_CHARS}
            value={value}
            placeholder="### Sobre mim"
            spellCheck
            className="font-mono text-sm"
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          {!value && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(README_TEMPLATE)}
            >
              Usar um modelo
            </Button>
          )}
        </TabsContent>

        <TabsContent value="visualizar">
          {preview === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Montando a prévia…
            </p>
          )}
          {preview && preview !== 'loading' && 'error' in preview && (
            <p className="text-sm font-semibold text-destructive">{preview.error}</p>
          )}
          {preview && preview !== 'loading' && 'tree' in preview && (
            <div className="gz-panel gz-readme">
              <p className="gz-readme-bar">
                <FileText className="gz-ico" aria-hidden="true" />
                <span className="gz-readme-title">README.md</span>
              </p>
              {value.trim() ? (
                <ReadmeView tree={preview.tree} />
              ) : (
                <p className="gz-readme-body text-muted-foreground">Nada escrito ainda.</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p
        id="readme-contador"
        className={cn(
          'text-xs text-muted-foreground tabular-nums',
          remaining <= 100 && 'font-semibold text-foreground',
        )}
      >
        {fmt(chars)} / {fmt(README_MAX_CHARS)} caracteres · {lines} / {README_MAX_LINES} linhas
      </p>
      <p className="sr-only" aria-live="polite">
        {remainingNotice(remaining)}
      </p>
      {error && (
        <p id="readme-erro" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
