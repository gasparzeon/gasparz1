'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BookUser, Home, LogOut, Plus, UserRound } from 'lucide-react';

import {
  canAccessPanel,
  canManageSite,
  canManageUsers,
  canModerateComments,
  roleInfo,
  type Role,
} from '@/lib/auth/permissions';
import { currentState } from '@/lib/navigation';
import { AuthorAvatar } from '@/components/author-avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoMark } from '@/components/site/section-sig';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type HeaderUser = {
  name: string;
  username: string;
  role: Role;
  avatarUrl: string;
};

export function AdminHeader({
  user,
  pendingUsers = 0,
}: {
  user: HeaderUser;
  pendingUsers?: number;
}) {
  const logoutForm = useRef<HTMLFormElement>(null);
  const pathname = usePathname() ?? '/admin';
  // "Posts" é o início do painel (/admin) e também a seção dos editores (/admin/posts/…).
  const postsState: 'page' | 'true' | undefined =
    pathname === '/admin' ? 'page' : pathname.startsWith('/admin/posts/') ? 'true' : undefined;

  const nav = [
    ...(canAccessPanel(user.role) ? [{ href: '/admin', label: 'Posts', current: postsState }] : []),
    ...(canModerateComments(user.role)
      ? [{ href: '/admin/comentarios', label: 'Comentários' }]
      : []),
    ...(canManageUsers(user.role)
      ? [{ href: '/admin/usuarios', label: 'Usuários', badge: pendingUsers }]
      : []),
    ...(canManageSite(user.role)
      ? [
          { href: '/admin/site', label: 'Site' },
          { href: '/admin/paginas', label: 'Páginas' },
        ]
      : []),
    { href: '/admin/perfil', label: 'Perfil' },
  ].map((item) => ({
    ...item,
    current: 'current' in item ? item.current : currentState(pathname, item.href),
  }));

  return (
    <header className="gz-root gz-admin-head">
      <a className="gz-skip" href="#painel">
        Pular para o conteúdo
      </a>
      <div className="gz-admin-head-in">
        {/* Sempre à vista, na mesma aba: o caminho de volta para o site. */}
        <Link href="/" className="gz-admin-back">
          <ArrowLeft className="gz-ico" aria-hidden="true" />
          {/* No celular aparece só "site"; o nome acessível é sempre "Voltar ao site". */}
          <span className="max-sm:sr-only">Voltar ao </span>
          site
        </Link>

        <Link href="/admin" className="gz-logo gz-admin-brand">
          <LogoMark />
          <span className="gz-sm-up">Gaspar Labs</span>
          <span className="gz-admin-tag">/admin</span>
          <span className="gz-sr">, início do painel</span>
        </Link>

        <nav className="gz-admin-nav" aria-label="Painel">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.current}>
              {item.label}
              {'badge' in item && item.badge ? (
                <span className="gz-count" aria-label={`${item.badge} pendentes`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="gz-admin-actions">
          <ThemeToggle />

          {canAccessPanel(user.role) && (
            <Link href="/admin/posts/new" className="gz-btn gz-btn--primary gz-btn--sm">
              <Plus className="gz-ico" aria-hidden="true" />
              <span className="gz-sm-up">Novo post</span>
              <span className="gz-sr sm:hidden">Novo post</span>
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={`Conta de ${user.name}`}
              >
                <AuthorAvatar author={user} size={36} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-sm font-bold">{user.name}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  @{user.username} · {roleInfo(user.role).label}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/perfil">
                  <UserRound />
                  Meu perfil
                </Link>
              </DropdownMenuItem>
              {canAccessPanel(user.role) && (
                <DropdownMenuItem asChild>
                  <Link href={`/autores/${user.username}`}>
                    <BookUser />
                    Minha página de autor
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/">
                  <Home />
                  Voltar ao site
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => logoutForm.current?.requestSubmit()}>
                <LogOut />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <form ref={logoutForm} action="/api/auth/logout" method="post" className="hidden" />
        </div>
      </div>
    </header>
  );
}
