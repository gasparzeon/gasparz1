'use client';

import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import type { SectionKey } from '@/lib/sections';
import { setMarqueePaused } from '@/lib/motion/gz-motion';

import { SectionSig } from './section-sig';

export type TickerItem = { id: string; number: string; title: string; section: SectionKey | null };

function TrackSet({ items }: { items: TickerItem[] }) {
  return (
    <div className="gz-track-set">
      {items.map((item) => (
        <span key={item.id} className="gz-tk">
          <SectionSig section={item.section} />
          <span className="gz-id">{item.number}</span>
          <span>{item.title}</span>
        </span>
      ))}
    </div>
  );
}

// Letreiro dos últimos posts. Anda sozinho, então tem botão de pausa (WCAG
// 2.2.2) e para com o mouse ou o foco em cima. O texto é decorativo: a mesma
// lista aparece em "Posts recentes".
export function Ticker({ items }: { items: TickerItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    if (ref.current) setMarqueePaused(ref.current, next);
  };

  return (
    <div className="gz-root gz-ticker" data-gz-ticker="" ref={ref}>
      <button
        type="button"
        className="gz-ticker-btn"
        onClick={toggle}
        aria-pressed={paused}
        aria-label="Pausar letreiro de últimos posts"
      >
        {paused ? (
          <Play className="gz-ico" aria-hidden="true" />
        ) : (
          <Pause className="gz-ico" aria-hidden="true" />
        )}
      </button>
      <div
        className="gz-ticker-view"
        data-gz-marquee=""
        data-gz-dur="48"
        data-gz-paused={paused ? 'true' : 'false'}
      >
        <div className="gz-track" data-gz-track="" aria-hidden="true">
          <TrackSet items={items} />
          <TrackSet items={items} />
        </div>
      </div>
    </div>
  );
}
