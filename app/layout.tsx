import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

import { ThemeProvider } from '@/components/theme-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { SearchWrapper } from '@/components/search-wrapper';
import { PlausibleAnalytics } from '@/components/plausible-analytics';
import { HideOnAdmin } from '@/components/hide-on-admin';
import { MotionRoot } from '@/components/site/motion-root';
import { SiteMain } from '@/components/site/site-main';
import { getAllPosts } from '@/lib/content';
import { MOTION_BOOT_SCRIPT } from '@/lib/motion/preference';
import { sectionCounts } from '@/lib/posts-view';
import { resolveSiteUrl } from '@/lib/site/schema';
import { getSiteSettings } from '@/lib/site/service';

import 'katex/dist/katex.min.css';
import './globals.css';
import './site.css';

// Atkinson Hyperlegible (Braille Institute): feita para leitura com baixa visão.
// O Next não tem as métricas dessas fontes para gerar o fallback ajustado (e
// avisa a cada compilação); usamos fallbacks do sistema declarados aqui.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-atkinson',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-atkinson-mono',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
});

// Título, descrição, prévias de links e integrações vêm do painel (/admin/site).
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const { name, description, author, keywords, shareImage } = settings.general;
  const images = shareImage ? [shareImage] : undefined;

  return {
    metadataBase: new URL(resolveSiteUrl(settings)),
    title: { default: name, template: `%s | ${name}` },
    description: description || undefined,
    keywords,
    authors: author ? [{ name: author }] : undefined,
    creator: author || undefined,
    icons: { icon: '/icon.png', shortcut: '/icon.png', apple: '/icon.png' },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      url: '/',
      siteName: name,
      title: name,
      description: description || undefined,
      images,
    },
    twitter: { card: 'summary', title: name, description: description || undefined, images },
    alternates: { types: { 'application/rss+xml': [{ url: '/rss.xml', title: name }] } },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#080a08',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, posts] = await Promise.all([getSiteSettings(), getAllPosts()]);
  const { plausible, vercelAnalytics } = settings.integrations;

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${atkinson.variable} ${atkinsonMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        {/* Preferência de animações antes da pintura (lib/motion/preference.ts). */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT }} />
        {/* Escuro é o padrão; o leitor pode trocar para o claro (fica salvo). */}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <HideOnAdmin>
            <Header navigation={settings.navigation} sectionCounts={sectionCounts(posts)} />
          </HideOnAdmin>

          <SiteMain>{children}</SiteMain>

          <HideOnAdmin>
            <Footer settings={settings} />
            {settings.navigation.showSearch && <SearchWrapper />}
            <MotionRoot />
          </HideOnAdmin>
        </ThemeProvider>

        {/* O script do Vercel Analytics só existe em deploys na Vercel. */}
        {vercelAnalytics.enabled && process.env.VERCEL && <Analytics />}

        <PlausibleAnalytics
          domain={plausible.enabled ? plausible.domain : undefined}
          src={plausible.scriptUrl}
        />
      </body>
    </html>
  );
}
