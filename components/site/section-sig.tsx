import type { SectionKey } from '@/lib/sections';
import { shapeClassFor } from '@/lib/posts-view';
import { cn } from '@/lib/utils';

// Forma da seção (círculo, quadrado, triângulo, losango, hexágono). Decorativa:
// o nome da seção sempre aparece ao lado, a forma só reforça.
export function SectionSig({
  section,
  className,
}: {
  section: SectionKey | null | undefined;
  className?: string;
}) {
  return <span aria-hidden="true" className={cn('gz-sig', shapeClassFor(section), className)} />;
}

export function LogoMark() {
  return (
    <span className="gz-logo-mark" aria-hidden="true">
      <i className="gz-k-circle" />
      <i className="gz-k-square" />
      <i className="gz-k-tri" />
      <i className="gz-k-diamond" />
    </span>
  );
}
