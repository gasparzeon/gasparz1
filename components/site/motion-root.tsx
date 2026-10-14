'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { initMotion } from '@/lib/motion/gz-motion';
import { isAdminPath } from '@/lib/navigation';
import { useMotionPref } from './prefs';

// Liga as animações (data-gz-*) da página atual e religa a cada navegação ou
// quando o leitor liga/desliga as animações. Uma instância no site e outra no
// painel (/admin), cada uma só enquanto o leitor está nela.
export function MotionRoot({ scope = 'site' }: { scope?: 'site' | 'admin' }) {
  const pathname = usePathname() ?? '/';
  const motion = useMotionPref();
  const inAdmin = isAdminPath(pathname);
  const active = scope === 'admin' ? inAdmin : !inAdmin;

  useEffect(() => {
    if (!active) return;
    return initMotion(document.body);
  }, [pathname, motion, active]);

  return null;
}
