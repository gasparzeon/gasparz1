'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';

import { COOKIES } from '@/lib/auth/config';

// Quem está logado, pelo próprio perfil. Visitante (sem a dica de sessão) nem
// pergunta ao servidor: nada de requisição nem de 401 no console.
async function signedInUsername(): Promise<string | null> {
  const hasHint = document.cookie
    .split('; ')
    .some((cookie) => cookie.startsWith(`${COOKIES.hint}=`));
  if (!hasHint) return null;
  try {
    const response = await fetch('/api/admin/me', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { profile?: { username?: unknown } };
    return typeof data.profile?.username === 'string' ? data.profile.username : null;
  } catch {
    return null;
  }
}

// Na própria página de autor, a pessoa vê o atalho para editar o README (e o
// resto do perfil). Para os outros, não aparece nada. A página é estática:
// a checagem é feita no navegador, depois de carregar.
export function OwnProfileEdit({ username, hasReadme }: { username: string; hasReadme: boolean }) {
  const [own, setOwn] = useState(false);

  useEffect(() => {
    let alive = true;
    void signedInUsername().then((me) => {
      if (alive) setOwn(me?.toLowerCase() === username.toLowerCase());
    });
    return () => {
      alive = false;
    };
  }, [username]);

  if (!own) return null;

  const button = (
    <a href="/admin/perfil#readme" className="gz-btn gz-btn--sm">
      <Pencil className="gz-ico" aria-hidden="true" />
      {hasReadme ? 'Editar meu README' : 'Escrever meu README'}
    </a>
  );

  if (hasReadme) return <div className="gz-readme-edit">{button}</div>;

  return (
    <div className="gz-panel gz-readme-empty mb-12">
      <p>
        Esta é a sua página de autor. Escreva um README curto: o que você pesquisa, seus interesses,
        no que está trabalhando.
      </p>
      {button}
    </div>
  );
}
