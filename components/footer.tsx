import Link from 'next/link';
import { Heart } from 'lucide-react';

import { fillTemplate, isExternalLink, siteNavLinks, type SiteSettings } from '@/lib/site/schema';
import { SocialIcon, socialName } from '@/components/site/icons';
import { Prefs } from '@/components/site/prefs';
import { LogoMark } from '@/components/site/section-sig';

const externalProps = (href: string) =>
  isExternalLink(href) && !href.startsWith('mailto:')
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

// Textos, links, redes e o link de apoio vêm das configurações do site (/admin/site).
export function Footer({ settings }: { settings: SiteSettings }) {
  const { copyright, note, cta } = settings.footer;
  const { logo, showAccountButtons } = settings.navigation;
  const links = siteNavLinks(settings.navigation);
  const social = settings.social.filter((link) => link.footer);
  const [first, ...rest] = settings.general.name.split(/\s+/);

  return (
    <footer className="gz-root gz-foot" data-gz-scope>
      <div className="gz-wrap">
        <div className="gz-foot-grid">
          <div className="gz-foot-lead">
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
            {settings.general.description && <p>{settings.general.description}</p>}
            {cta.enabled && cta.label && cta.href && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={cta.href}
                  {...externalProps(cta.href)}
                  className="gz-btn gz-btn--primary"
                >
                  <Heart className="gz-ico" aria-hidden="true" />
                  {cta.label}
                </Link>
              </div>
            )}
          </div>

          {links.length > 0 && (
            <nav aria-labelledby="gz-foot-nav">
              <h2 id="gz-foot-nav">Navegar</h2>
              <ul className="gz-foot-links">
                {links.map((item) => (
                  <li key={`${item.href}-${item.label}`}>
                    <Link href={item.href} {...externalProps(item.href)}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {social.length > 0 && (
            <nav aria-labelledby="gz-foot-social">
              <h2 id="gz-foot-social">Redes</h2>
              <ul className="gz-foot-links">
                {social.map((link) => (
                  <li key={`${link.network}-${link.url}`}>
                    <a href={link.url} {...externalProps(link.url)}>
                      <span aria-hidden="true">
                        <SocialIcon network={link.network} className="h-4 w-4" />
                      </span>
                      {socialName(link.network)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {showAccountButtons && (
            <nav aria-labelledby="gz-foot-account">
              <h2 id="gz-foot-account">Conta</h2>
              <ul className="gz-foot-links">
                <li>
                  <a href="/api/auth/login">Entrar</a>
                </li>
                <li>
                  <a href="/admin/cadastro">Criar conta</a>
                </li>
              </ul>
            </nav>
          )}
        </div>

        <div className="gz-prefs">
          <Prefs />
        </div>

        <p className="gz-wordmark" aria-hidden="true">
          <span data-gz-scramble="">{first}</span>
          <span className="gz-wm-shape" data-gz-speed="0.6" data-gz-rotate="180" />
          {rest.length > 0 && <span data-gz-scramble="">{rest.join(' ')}</span>}
        </p>

        <div className="gz-foot-bar">
          {copyright && <p>{fillTemplate(copyright, settings)}</p>}
          {note && <p>{note}</p>}
          <a className="gz-textlink" href="#conteudo">
            Voltar ao topo
          </a>
        </div>
      </div>
    </footer>
  );
}
