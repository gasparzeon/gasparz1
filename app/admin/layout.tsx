import type { Metadata } from 'next';

import { getSiteSettings } from '@/lib/site/service';
import { Toaster } from '@/components/ui/sonner';
import { MotionRoot } from '@/components/site/motion-root';

// O painel consulta o banco (sessão, configurações) a cada acesso:
// nunca deve ser pré-renderizado no build (na Vercel, sem DATABASE_URL
// o PGlite local nem existe e o build quebra com DatabaseConfigError).
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { general } = await getSiteSettings();
  return {
    title: { default: 'Admin', template: `%s · Admin · ${general.name}` },
    robots: { index: false, follow: false },
  };
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
      <MotionRoot scope="admin" />
    </>
  );
}
