import type { CSSProperties } from 'react';

import type { SectionKey } from '@/lib/sections';
import { shapeClassFor } from '@/lib/posts-view';
import { cn } from '@/lib/utils';

// Capa do post. Sem imagem, é gerada a partir da forma da seção (cada seção
// tem cor de fundo e composição próprias); com imagem, a foto entra na mesma
// moldura. Decorativa: título e seção sempre aparecem em texto ao lado.

type Layout = { ring: CSSProperties; big: CSSProperties; small: CSSProperties };

const CARD: Layout = {
  ring: { right: '-14%', top: '-24%', width: '72%', aspectRatio: '1' },
  big: { right: '7%', top: '9%', width: '46%', aspectRatio: '1' },
  small: { left: '9%', top: '18%', width: '16%', aspectRatio: '1' },
};

const WIDE: Layout = {
  ring: { right: '-6%', top: '-40%', width: '46%', aspectRatio: '1' },
  big: { right: '9%', top: '12%', width: '30%', aspectRatio: '1' },
  small: { left: '46%', top: '14%', width: '9%', aspectRatio: '1' },
};

export function PostCover({
  section,
  image,
  tag,
  variant = 'card',
  className,
  priority = false,
}: {
  section: SectionKey | null;
  image?: string | null;
  tag?: string;
  variant?: 'card' | 'wide';
  className?: string;
  priority?: boolean;
}) {
  const layout = variant === 'wide' ? WIDE : CARD;
  const shape = shapeClassFor(section);

  return (
    <div
      aria-hidden="true"
      data-gz-scope
      className={cn(
        'gz-cover gz-cut gz-brackets',
        image ? 'gz-cover--image' : `gz-cv-${section ?? 'none'}`,
        className,
      )}
    >
      <span className="gz-scan" data-gz-scan />
      {tag && <span className="gz-cover-tag">{tag}</span>}
      {image ? (
        <img
          src={image}
          alt=""
          {...(priority ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}
        />
      ) : (
        <>
          <div className="gz-cs gz-cs--ring" style={layout.ring} data-gz-speed="0.4">
            <i />
          </div>
          <div className="gz-cs" style={layout.big} data-gz-speed="0.8">
            <i className={shape} />
          </div>
          <div className="gz-cs gz-cs--b" style={layout.small} data-gz-speed="1.4">
            <i className={shape} />
          </div>
        </>
      )}
    </div>
  );
}
