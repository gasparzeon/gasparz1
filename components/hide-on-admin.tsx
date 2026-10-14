'use client';

import { usePathname } from 'next/navigation';

import { isAdminPath } from '@/lib/navigation';

// O painel /admin tem cabeçalho próprio; esconde o chrome do site lá.
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isAdminPath(pathname)) return null;

  return <>{children}</>;
}
