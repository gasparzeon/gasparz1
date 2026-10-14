'use client';

import { useEffect, useState } from 'react';

import { useMotionPref } from './prefs';

const pad = (n: number) => String(n).padStart(2, '0');

// Relógio da barra de status. Com as animações desligadas mostra só hora e
// minuto (nada atualizando a cada segundo).
export function LiveClock() {
  const motion = useMotionPref();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, motion === 'off' ? 30_000 : 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [motion]);

  if (!now) return <b>--:--</b>;
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return <b>{motion === 'off' ? hm : `${hm}:${pad(now.getSeconds())}`}</b>;
}
