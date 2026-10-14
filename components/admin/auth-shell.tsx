import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

import { LogoMark } from '@/components/site/section-sig';

// Moldura das telas públicas do painel (login, cadastro, pedido de acesso,
// convite e redefinição de senha). Mesmo visual do site: escuro por padrão,
// títulos em mono, cantos chanfrados.

const ROUTES = [
  '/admin /admin/posts/new /admin/site /admin/paginas',
  '/admin/usuarios /admin/comentarios /admin/perfil',
  '/api/auth/login /oauth/token code_challenge=S256',
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="gz-root gz-auth">
      <header className="gz-wrap gz-auth-top">
        <Link href="/" className="gz-admin-back">
          <ArrowLeft className="gz-ico" aria-hidden="true" />
          Voltar ao site
        </Link>
      </header>

      <div className="gz-slugs" aria-hidden="true" data-gz-scope="">
        {ROUTES.map((row, index) => (
          <div key={row} className="gz-slug-row" data-gz-drift={index % 2 ? -1 : 1}>
            {index === 0 ? <em>{row}</em> : row}
          </div>
        ))}
      </div>

      <main id="painel" tabIndex={-1} className="gz-wrap gz-auth-in outline-none">
        <div className="gz-status">
          <span className="gz-live">
            <span className="gz-dot" aria-hidden="true" />
            acesso restrito
          </span>
          <span>oauth 2.0 · pkce</span>
          <span className="gz-sm-up">sessão protegida</span>
        </div>

        <div className="gz-auth-grid">
          <div className="gz-auth-intro">
            <Link href="/" className="gz-logo">
              <LogoMark />
              Gaspar Labs
            </Link>
            <p className="gz-kicker" data-gz-intro="">
              <b>~/</b>admin
            </p>
            <h1 className="gz-h1" data-gz-scramble="intro">
              Painel do arquivo
            </h1>
            <p className="gz-lead gz-sm-up" data-gz-intro="">
              Escreva, revise e publique. Quem lê comenta no site; quem publica escreve aqui.
            </p>
          </div>

          <div className="gz-panel gz-auth-card" data-gz-intro="">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthNotice({
  icon: Icon,
  title,
  description,
  action = 'Entrar',
  href = '/api/auth/login',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="grid gap-4">
      <span className="gz-sec-ico gz-cut" aria-hidden="true">
        <Icon className="gz-ico" />
      </span>
      <h2 className="gz-h3">{title}</h2>
      <p className="gz-small">{description}</p>
      <a href={href} className="gz-btn gz-btn--primary w-full">
        {action}
      </a>
    </div>
  );
}
