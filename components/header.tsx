'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';

import { COOKIES } from '@/lib/auth/config';
import { isExternalLink, siteNavLinks, type SiteSettings } from '@/lib/site/schema';
import { currentState } from '@/lib/navigation';
import type { SectionKey } from '@/lib/sections';
import { ThemeToggle } from '@/components/theme-toggle';
import { SearchTrigger } from '@/components/search-trigger';
import { LogoMark } from '@/components/site/section-sig';
import { SiteMenu } from '@/components/site/site-menu';

// Login e logout recarregam a página, então não há o que observar.
const subscribe = () => () => {};
const hasSessionHint = () =>
  document.cookie.split('; ').some((cookie) => cookie.startsWith(`${COOKIES.hint}=`));

// No servidor (e na hidratação) é sempre "Entrar"; no cliente, troca para
// "Painel" se houver a dica de sessão. useSyncExternalStore faz essa troca
// sem erro de hidratação.
function useSignedIn() {
  return useSyncExternalStore(subscribe, hasSessionHint, () => false);
}

function AccountActions({ compact = false }: { compact?: boolean }) {
  const signedIn = useSignedIn();

  // <a> e não <Link>: são rotas com redirecionamento (OAuth), não páginas.
  if (signedIn) {
    return (
      <a href="/admin" className="gz-btn gz-btn--dark gz-btn--sm">
        <LayoutDashboard className="gz-ico" aria-hidden="true" />
        Painel
      </a>
    );
  }

  return (
    <>
      {!compact && (
        <a href="/admin/cadastro" className="gz-btn gz-btn--sm">
          Criar conta
        </a>
      )}
      <a href="/api/auth/login" className="gz-btn gz-btn--dark gz-btn--sm">
        Entrar
      </a>
    </>
  );
}

interface HeaderProps {
  // Logo, menu e botões vêm das configurações do site (/admin/site).
  navigation: SiteSettings['navigation'];
  // Quantos posts cada seção tem (aparece no menu).
  sectionCounts?: Partial<Record<SectionKey, number>>;
}

export function Header({ navigation, sectionCounts }: HeaderProps) {
  const pathname = usePathname() ?? '/';
  const { logo, showSearch, showThemeToggle, showAccountButtons } = navigation;
  const links = siteNavLinks(navigation);
  const isActive = (href: string) => currentState(pathname, href);

  return (
    <header className="gz-root gz-head">
      <a className="gz-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div className="gz-wrap gz-head-in">
        <Link href="/" className="gz-logo">
          <LogoMark />
          {logo.text}
          {logo.accent && (
            <>
              {' '}
              <span className="gz-logo-accent">{logo.accent}</span>
            </>
          )}
        </Link>

        <nav className="gz-nav" aria-label="Principal">
          {links.map((item) => (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              {...(isExternalLink(item.href)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              aria-current={isActive(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="gz-actions">
          {showSearch && <SearchTrigger />}
          {showThemeToggle && <ThemeToggle />}
          {showAccountButtons && (
            <div className="gz-lg-up flex gap-1">
              <AccountActions compact />
            </div>
          )}
          <SiteMenu
            navigation={navigation}
            sectionCounts={sectionCounts}
            isActive={isActive}
            accountActions={showAccountButtons ? <AccountActions /> : undefined}
          />
        </div>
      </div>
    </header>
  );
}
