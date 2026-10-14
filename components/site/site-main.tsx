'use client';

import { usePathname } from 'next/navigation';

import { isAdminPath } from '@/lib/navigation';

// Área principal do site (alvo do "Pular para o conteúdo"). No painel não:
// lá cada tela tem o próprio <main> depois do cabeçalho do painel, e duas
// áreas principais (uma dentro da outra) confundem leitores de tela.
export function SiteMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isAdminPath(pathname)) return <div className="flex flex-1 flex-col">{children}</div>;

  return (
    <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
      {children}
    </main>
  );
}
