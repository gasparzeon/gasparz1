'use client';

import { useEffect, useRef, useState } from 'react';
import { Film, ImagePlus, Library, Link2, Trash2, Upload, Youtube } from 'lucide-react';
import { toast } from 'sonner';

import { adminFetch } from '@/lib/admin/client';
import { altFromFileName } from '@/lib/admin/markdown';
import { uploadMedia } from '@/lib/admin/upload';
import { formatBytes, type MediaItem, type MediaMode } from '@/lib/cms/media-types';
import { isSafeMediaUrl } from '@/lib/cms/schema';
import { parseYouTube } from '@/lib/markdown/youtube';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type MediaDialogKind = 'image' | 'video' | 'youtube' | 'cover';

export type MediaInsert =
  | { kind: 'image'; url: string; alt: string; caption: string }
  | { kind: 'video'; url: string; caption: string }
  | { kind: 'youtube'; id: string; start?: number; caption: string };

const TITLES: Record<MediaDialogKind, { title: string; description: string }> = {
  image: {
    title: 'Inserir imagem',
    description: 'Envie um arquivo, cole uma URL ou escolha da biblioteca.',
  },
  video: {
    title: 'Inserir vídeo',
    description: 'MP4 ou WebM. Vídeos grandes vão direto para o storage.',
  },
  youtube: {
    title: 'Incorporar YouTube',
    description: 'Cole o link do vídeo. Ele carrega só quando o leitor clicar.',
  },
  cover: {
    title: 'Imagem de capa',
    description: 'Aparece no topo do post e nas prévias de redes sociais.',
  },
};

function titleFor(kind: MediaDialogKind) {
  // eslint-disable-next-line security/detect-object-injection -- chave tipada (união literal do código), não vem de entrada externa
  return TITLES[kind];
}

interface MediaDialogProps {
  kind: MediaDialogKind | null;
  mediaMode: MediaMode;
  onClose: () => void;
  onInsert: (media: MediaInsert) => void;
}

export function MediaDialog({ kind, mediaMode, onClose, onInsert }: MediaDialogProps) {
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {kind && (
          <>
            <DialogHeader>
              <DialogTitle>{titleFor(kind).title}</DialogTitle>
              <DialogDescription>{titleFor(kind).description}</DialogDescription>
            </DialogHeader>
            {kind === 'youtube' ? (
              <YouTubePicker onInsert={onInsert} />
            ) : (
              <FilePicker kind={kind} mediaMode={mediaMode} onInsert={onInsert} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function YouTubePicker({ onInsert }: { onInsert: (media: MediaInsert) => void }) {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const video = parseYouTube(url);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (video) onInsert({ kind: 'youtube', id: video.id, start: video.start, caption });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="youtube-url">Link do vídeo</Label>
        <Input
          id="youtube-url"
          autoFocus
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        {url && !video && (
          <p className="text-xs text-destructive">Não reconheci esse link do YouTube.</p>
        )}
      </div>

      {video && (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black">
          <img
            src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
            alt=""
            className="h-full w-full object-cover"
          />
          <span className="absolute top-1/2 left-1/2 flex h-12 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-red-600">
            <Youtube className="h-6 w-6 text-white" />
          </span>
          {video.start && (
            <span className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              começa em {Math.floor(video.start / 60)}:{String(video.start % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="youtube-caption">Legenda (opcional)</Label>
        <Input
          id="youtube-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!video}>
          Incorporar
        </Button>
      </DialogFooter>
    </form>
  );
}

function FilePicker({
  kind,
  mediaMode,
  onInsert,
}: {
  kind: 'image' | 'video' | 'cover';
  mediaMode: MediaMode;
  onInsert: (media: MediaInsert) => void;
}) {
  const mediaKind = kind === 'video' ? 'video' : 'image';
  const [selected, setSelected] = useState<{ url: string; name?: string } | null>(null);
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');

  const choose = (url: string, name?: string) => {
    setSelected({ url, name });
    setAlt(name ? altFromFileName(name) : '');
  };

  if (selected) {
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (mediaKind === 'video') onInsert({ kind: 'video', url: selected.url, caption });
          else onInsert({ kind: 'image', url: selected.url, alt, caption });
        }}
      >
        <div className="overflow-hidden rounded-lg border border-border bg-black/40">
          {mediaKind === 'video' ? (
            <video src={selected.url} controls className="max-h-72 w-full" />
          ) : (
            <img src={selected.url} alt="" className="mx-auto max-h-72 object-contain" />
          )}
        </div>

        {kind === 'image' && (
          <div className="space-y-2">
            <Label htmlFor="media-alt">Texto alternativo</Label>
            <Input
              id="media-alt"
              placeholder="Descreva a imagem para leitores de tela"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
            />
          </div>
        )}

        {kind !== 'cover' && (
          <div className="space-y-2">
            <Label htmlFor="media-caption">Legenda (opcional)</Label>
            <Input
              id="media-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
            Trocar
          </Button>
          <Button type="submit" autoFocus>
            {kind === 'cover' ? 'Usar como capa' : 'Inserir'}
          </Button>
        </DialogFooter>
      </form>
    );
  }

  return (
    <Tabs defaultValue={mediaMode === 'disabled' ? 'url' : 'upload'}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="upload">
          <Upload className="h-3.5 w-3.5" /> Enviar
        </TabsTrigger>
        <TabsTrigger value="url">
          <Link2 className="h-3.5 w-3.5" /> URL
        </TabsTrigger>
        <TabsTrigger value="library">
          <Library className="h-3.5 w-3.5" /> Biblioteca
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="pt-3">
        <UploadZone kind={mediaKind} mediaMode={mediaMode} onUploaded={choose} />
      </TabsContent>

      <TabsContent value="url" className="pt-3">
        <UrlField kind={mediaKind} onSubmit={(url) => choose(url)} />
      </TabsContent>

      <TabsContent value="library" className="pt-3">
        <LibraryGrid
          kind={mediaKind}
          onPick={(item) => choose(item.url, item.pathname.split('/').pop())}
        />
      </TabsContent>
    </Tabs>
  );
}

function UploadZone({
  kind,
  mediaMode,
  onUploaded,
}: {
  kind: 'image' | 'video';
  mediaMode: MediaMode;
  onUploaded: (url: string, name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  if (mediaMode === 'disabled') {
    return (
      <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm leading-relaxed text-muted-foreground">
        Upload indisponível neste ambiente. Conecte um store do{' '}
        <strong className="text-foreground">Vercel Blob</strong> ao projeto (variável{' '}
        <code>BLOB_READ_WRITE_TOKEN</code>) ou use a aba URL.
      </p>
    );
  }

  const accept =
    kind === 'image'
      ? 'image/jpeg,image/png,image/webp,image/gif,image/avif'
      : 'video/mp4,video/webm';

  const send = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith(`${kind}/`)) {
      toast.error(
        kind === 'image' ? 'Escolha um arquivo de imagem.' : 'Escolha um arquivo de vídeo.',
      );
      return;
    }
    setProgress(0);
    try {
      const result = await uploadMedia(file, { mode: mediaMode, onProgress: setProgress });
      onUploaded(result.url, file.name);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const Icon = kind === 'image' ? ImagePlus : Film;

  return (
    <button
      type="button"
      disabled={progress !== null}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        void send(event.dataTransfer.files[0]);
      }}
      className={cn(
        'flex h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground',
        over && 'border-accent bg-secondary/40 text-foreground',
      )}
    >
      {progress !== null ? (
        <>
          <Spinner className="h-5 w-5" />
          <span>Enviando… {Math.round(progress * 100)}%</span>
          <span className="h-1 w-48 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full bg-foreground transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        </>
      ) : (
        <>
          <Icon className="h-7 w-7" />
          <span>
            <strong className="text-foreground">Clique para escolher</strong> ou arraste o arquivo
          </span>
          <span className="text-xs">
            {kind === 'image'
              ? 'JPG, PNG, WebP, GIF ou AVIF · até 15 MB'
              : 'MP4 ou WebM · até 500 MB'}
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void send(file);
        }}
      />
    </button>
  );
}

function UrlField({
  kind,
  onSubmit,
}: {
  kind: 'image' | 'video';
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState('');
  const valid = isSafeMediaUrl(url.trim());

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSubmit(url.trim());
      }}
    >
      <Label htmlFor="media-url">URL {kind === 'image' ? 'da imagem' : 'do vídeo'}</Label>
      <div className="flex gap-2">
        <Input
          id="media-url"
          placeholder={kind === 'image' ? 'https://…/foto.jpg' : 'https://…/video.mp4'}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Button type="submit" disabled={!valid}>
          Usar
        </Button>
      </div>
    </form>
  );
}

function LibraryGrid({
  kind,
  onPick,
}: {
  kind: 'image' | 'video';
  onPick: (item: MediaItem) => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminFetch<{ items: MediaItem[] }>('/api/admin/media')
      .then((data) => active && setItems(data.items))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  const remove = async (item: MediaItem) => {
    try {
      await adminFetch('/api/admin/media', {
        method: 'DELETE',
        body: JSON.stringify({ url: item.url }),
      });
      setItems((current) => current?.filter((entry) => entry.url !== item.url) ?? null);
      toast.success('Arquivo removido da biblioteca.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirming(null);
    }
  };

  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>;
  if (!items) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  const filtered = items.filter((item) => item.kind === kind);
  if (filtered.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {kind === 'image' ? 'Nenhuma imagem enviada ainda.' : 'Nenhum vídeo enviado ainda.'}
      </p>
    );
  }

  return (
    <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1">
      {filtered.map((item) => (
        <div
          key={item.url}
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-black/40"
        >
          <button
            type="button"
            onClick={() => onPick(item)}
            className="h-full w-full"
            title={item.pathname}
          >
            {item.kind === 'image' ? (
              <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <video
                src={item.url}
                preload="metadata"
                muted
                className="h-full w-full object-cover"
              />
            )}
          </button>
          <span className="pointer-events-none absolute right-0 bottom-0 left-0 truncate bg-gradient-to-t from-black/80 px-2 pt-4 pb-1 text-[10px] text-white/80">
            {formatBytes(item.size)}
          </span>
          {confirming === item.url ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-2 text-center text-xs text-white">
              Remover? Posts que usam o arquivo ficarão sem ele.
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7"
                  onClick={() => remove(item)}
                >
                  Remover
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => setConfirming(null)}
                >
                  Não
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(item.url)}
              className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600 focus:opacity-100"
              aria-label="Remover arquivo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
