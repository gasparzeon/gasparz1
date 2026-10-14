'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, Search, X } from 'lucide-react';

import { isExternalLink, siteNavLinks, type SiteSettings } from '@/lib/site/schema';
import { SECTIONS, type SectionKey } from '@/lib/sections';
import { plural } from '@/lib/posts-view';
import { useSearchStore } from '@/lib/search-store';

import { Prefs } from './prefs';
import { SectionSig } from './section-sig';

const externalProps = (href: string) =>
  isExternalLink(href) && !href.startsWith('mailto:')
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

// Menu em painel lateral (Radix Dialog): prende o foco, fecha com Esc e
// devolve o foco ao botão "Menu". Traz busca, páginas, seções e preferências.
export function SiteMenu({
  navigation,
  sectionCounts,
  isActive,
  accountActions,
}: {
  navigation: SiteSettings['navigation'];
  sectionCounts?: Partial<Record<SectionKey, number>>;
  // "page" na própria página, "true" dentro da seção (lib/navigation.ts).
  isActive: (href: string) => 'page' | 'true' | undefined;
  accountActions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { setOpen: setSearchOpen } = useSearchStore();
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="gz-btn gz-btn--sm">
          <Menu className="gz-ico" aria-hidden="true" />
          <span>Menu</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          data-slot="sheet-overlay"
          className="fixed inset-0 z-[90] bg-black/60 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          data-slot="sheet-content"
          aria-describedby={undefined}
          className="gz-root gz-menu-panel fixed inset-y-0 right-0 z-[91] w-full max-w-[26rem] border-l data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:duration-300 data-[state=open]:slide-in-from-right"
        >
          <div className="gz-menu-top">
            <Dialog.Title className="gz-h3">Menu</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="gz-btn gz-btn--sm">
                <X className="gz-ico" aria-hidden="true" />
                <span>Fechar</span>
              </button>
            </Dialog.Close>
          </div>

          {navigation.showSearch && (
            <button
              type="button"
              className="gz-btn gz-btn--primary"
              onClick={() => {
                close();
                setSearchOpen(true);
              }}
            >
              <Search className="gz-ico" aria-hidden="true" />
              Buscar no arquivo
            </button>
          )}

          <nav className="gz-menu-nav" aria-label="Páginas">
            <Link href="/" aria-current={pathname === '/' ? 'page' : undefined} onClick={close}>
              Início
            </Link>
            {siteNavLinks(navigation).map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                {...externalProps(item.href)}
                aria-current={isActive(item.href)}
                onClick={close}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div>
            <p className="gz-menu-label">Seções</p>
            <div className="gz-menu-secs">
              {SECTIONS.map((section) => (
                <Link key={section.key} href={`/posts?secao=${section.key}`} onClick={close}>
                  <SectionSig section={section.key} />
                  {section.many}
                  {sectionCounts && (
                    <span className="gz-small">
                      {plural(sectionCounts[section.key] ?? 0, 'post', 'posts')}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <Prefs />

          {accountActions && <div className="flex flex-wrap gap-2">{accountActions}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
