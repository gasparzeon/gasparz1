'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';

interface ShareButtonsProps {
  title: string;
  // Endereço público do post (o canônico, vindo do servidor).
  url: string;
  // Redes ligadas em /admin/site → Integrações.
  networks?: { x: boolean; linkedin: boolean };
}

export function ShareButtons({
  title,
  url,
  networks = { x: true, linkedin: true },
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Sem permissão de área de transferência: o link continua visível na citação.
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2500);
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div>
      <div className="gz-share">
        <button type="button" className="gz-btn gz-btn--dark gz-btn--sm" onClick={copy}>
          {copied ? (
            <Check className="gz-ico" aria-hidden="true" />
          ) : (
            <Link2 className="gz-ico" aria-hidden="true" />
          )}
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
        {networks.x && (
          <a
            className="gz-btn gz-btn--sm"
            href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Compartilhar no X
          </a>
        )}
        {networks.linkedin && (
          <a
            className="gz-btn gz-btn--sm"
            href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Compartilhar no LinkedIn
          </a>
        )}
      </div>
      <p className="gz-sr" aria-live="polite">
        {copied ? 'Link do post copiado.' : ''}
      </p>
    </div>
  );
}
