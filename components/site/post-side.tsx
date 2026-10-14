'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

type Heading = { id: string; text: string; level: number };

const SIZES = [
  { key: 'normal', label: 'Normal', scale: '1' },
  { key: 'grande', label: 'Grande', scale: '1.12' },
  { key: 'maior', label: 'Maior', scale: '1.26' },
] as const;
type SizeKey = (typeof SIZES)[number]['key'];
const SIZE_KEY = 'gz-fs';

function applySize(key: SizeKey) {
  const size = SIZES.find((item) => item.key === key) ?? SIZES[0];
  document.documentElement.style.setProperty('--gz-fs', size.scale);
}

// Lateral do post: índice (abre e fecha no celular, fixo no desktop) com a
// parte atual e o tempo restante, e o tamanho do texto (fica salvo).
export function PostSide({ minutes }: { minutes: number }) {
  const id = useId();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(minutes);
  const [size, setSize] = useState<SizeKey>('normal');

  // Títulos do texto (h2 e h3), sem o "#" das âncoras nem o título invisível das notas.
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-gz-article] .prose :is(h2, h3):not(.sr-only)'),
    ).filter((el) => el.id);
    // Se o título estiver decodificando, o texto real está no aria-label.
    const items = elements.map((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.heading-anchor').forEach((anchor) => anchor.remove());
      const text = el.getAttribute('aria-label') ?? clone.textContent ?? '';
      return { id: el.id, text: text.trim(), level: Number(el.tagName[1]) };
    });
    const frame = requestAnimationFrame(() => setHeadings(items));

    // Parte atual: o último título que já passou de 40% da tela.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '0px 0px -60% 0px' },
    );
    elements.forEach((el) => observer.observe(el));

    // Tempo restante pela posição da leitura no artigo.
    const article = document.querySelector<HTMLElement>('[data-gz-article]');
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      setRemaining(Math.max(1, Math.ceil(minutes * (1 - progress))));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [minutes]);

  useEffect(() => {
    let saved: SizeKey = 'normal';
    try {
      const value = localStorage.getItem(SIZE_KEY);
      if (SIZES.some((item) => item.key === value)) saved = value as SizeKey;
    } catch {
      // Sem armazenamento: fica o tamanho normal.
    }
    applySize(saved);
    const frame = requestAnimationFrame(() => setSize(saved));
    return () => cancelAnimationFrame(frame);
  }, []);

  const chooseSize = (key: SizeKey) => {
    setSize(key);
    applySize(key);
    try {
      localStorage.setItem(SIZE_KEY, key);
    } catch {
      // Vale só para esta visita.
    }
  };

  const parts = headings.filter((heading) => heading.level === 2);
  const activeIndex = headings.findIndex((heading) => heading.id === active);
  const part =
    activeIndex === -1 ? 0 : headings.slice(0, activeIndex + 1).filter((h) => h.level === 2).length;
  const status = `${parts.length > 0 ? `parte ${Math.max(part, 1)} de ${parts.length} · ` : ''}${remaining} min restantes`;
  return (
    <div className="gz-side">
      {headings.length > 0 && (
        <nav className={cn('gz-toc', open && 'is-open')} aria-labelledby={`${id}-t`}>
          <button
            type="button"
            className="gz-toc-btn"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            onClick={() => setOpen(!open)}
          >
            <span>
              <span id={`${id}-t`}>Neste post</span>
              <small>{status}</small>
            </span>
            <ChevronDown className="gz-ico" aria-hidden="true" />
          </button>
          <p className="gz-toc-h" aria-hidden="true">
            Neste post
          </p>
          <p className="gz-hud" aria-hidden="true">
            {status}
          </p>
          <ol id={`${id}-list`} className="gz-toc-list">
            {headings.map((heading, index) => {
              const number = headings.slice(0, index + 1).filter((h) => h.level === 2).length;
              const isActive = heading.id === active;
              return (
                <li key={heading.id} className={heading.level === 3 ? 'is-sub' : undefined}>
                  <a
                    href={`#${heading.id}`}
                    className={isActive ? 'is-active' : undefined}
                    aria-current={isActive ? 'location' : undefined}
                  >
                    <span className="gz-toc-n" aria-hidden="true">
                      {heading.level === 2 ? number : '·'}
                    </span>
                    <span>{heading.text}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="gz-toolbar">
        <div className="gz-pref" role="group" aria-labelledby={`${id}-fs`}>
          <span id={`${id}-fs`} className="gz-pref-name">
            Tamanho do texto
          </span>
          <div className="gz-seg">
            {SIZES.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={size === item.key}
                onClick={() => chooseSize(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
