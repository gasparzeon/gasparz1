'use client';

import { useEffect } from 'react';

import {
  getSessionExpiry,
  redirectToLogin,
  refreshSession,
  setSessionExpiry,
} from '@/lib/admin/client';

// Renova o access token (15 min) em segundo plano enquanto o painel está
// aberto, para que o autor não perca a sessão no meio de um texto.
export function SessionKeepAlive({ expiresAt }: { expiresAt: number }) {
  useEffect(() => {
    setSessionExpiry(expiresAt);

    const check = async () => {
      const remaining = getSessionExpiry() - Date.now() / 1000;
      if (remaining > 5 * 60) return;

      const result = await refreshSession();
      if (!result.ok && result.reason === 'expired') redirectToLogin();
    };

    const interval = window.setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [expiresAt]);

  return null;
}
