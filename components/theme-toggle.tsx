'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

// Os dois ícones vêm no HTML e o CSS mostra o certo (o next-themes coloca a
// classe .dark/.light no <html> antes da hidratação). Servidor e cliente
// renderizam exatamente o mesmo HTML.
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <button
      type="button"
      className="gz-btn gz-btn--ghost gz-btn--icon gz-btn--sm"
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
      title="Alternar entre tema escuro e claro"
    >
      <Sun className="gz-ico hidden dark:block" aria-hidden="true" />
      <Moon className="gz-ico dark:hidden" aria-hidden="true" />
      <span className="gz-sr">Alternar tema</span>
    </button>
  );
}
