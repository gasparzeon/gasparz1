import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { SearchWrapper } from '@/components/search-wrapper'
import { PlausibleAnalytics } from '@/components/plausible-analytics'
import './globals.css'

const satoshi = localFont({
  src: [
    {
      path: '../public/fonts/Satoshi-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/Satoshi-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-satoshi',
  display: 'swap',
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Gaspar - 2026',
    template: '%s | Gaspar',
  },
  description: 'Um espaco para pensar em voz alta sobre o craft de construir e entender sistemas.',
  keywords: ['desenvolvimento', 'programacao', 'software', 'tecnologia', 'arquitetura', 'sistemas'],
  authors: [{ name: 'Gaspar' }],
  creator: 'Gaspar',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Gaspar',
    title: 'Gaspar - 2026',
    description: 'Um espaco para pensar em voz alta sobre o craft de construir e entender sistemas.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gaspar',
    description: 'Gaspar - 2026',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html 
      lang="pt-BR" 
      suppressHydrationWarning 
      className={`${satoshi.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <SearchWrapper />
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <PlausibleAnalytics domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} />
      </body>
    </html>
  )
}
