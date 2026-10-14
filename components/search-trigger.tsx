'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { useSearchStore } from '@/lib/search-store';

export function SearchTrigger() {
  const { setOpen } = useSearchStore();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setOpen]);

  return (
    <button
      type="button"
      className="gz-btn gz-btn--ghost gz-btn--sm"
      onClick={() => setOpen(true)}
      aria-label="Buscar posts (Ctrl ou Cmd + K)"
    >
      <Search className="gz-ico" aria-hidden="true" />
      <span className="gz-sm-up">Buscar</span>
    </button>
  );
}
