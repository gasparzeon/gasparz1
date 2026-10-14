'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

import { parseYouTube } from '@/lib/markdown/youtube';

interface YouTubeProps {
  id?: string;
  url?: string;
  start?: string | number;
  title?: string;
  caption?: string;
}

// Facade: mostra só a miniatura e carrega o player (youtube-nocookie)
// no clique. Evita ~1 MB de JavaScript do YouTube por vídeo na página.
export function YouTube({ id, url, start, title, caption }: YouTubeProps) {
  const [playing, setPlaying] = useState(false);
  const video = parseYouTube(id ?? url);

  if (!video) return null;

  const startAt = Number(start ?? video.start) || 0;
  const label = title || caption || 'Vídeo do YouTube';
  const params = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1' });
  if (startAt) params.set('start', String(startAt));

  return (
    <figure className="md-figure">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?${params}`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full cursor-pointer"
            aria-label={`Reproduzir vídeo: ${label}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              className="!m-0 h-full w-full !rounded-none object-cover opacity-85 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-100"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span className="absolute top-1/2 left-1/2 flex h-14 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-red-600 shadow-xl shadow-black/40 transition-transform group-hover:scale-110">
              <Play className="h-6 w-6 fill-white text-white" />
            </span>
            <span className="absolute right-4 bottom-3 left-4 truncate text-left text-sm font-medium text-white/90">
              {title || 'YouTube'}
            </span>
          </button>
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
