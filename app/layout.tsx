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

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://gaspar-blog.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: 'Gaspar Labs',
    template: '%s | Gaspar Labs',
  },

  description:
    'Research, systems, cybersecurity, IA e underground web.',

  keywords: [
    'gaspar labs',
    'desenvolvimento',
    'programacao',
    'software',
    'tecnologia',
    'arquitetura',
    'sistemas',
    'cybersecurity',
    'hacking',
    'ia',
    'internet',
  ],

  authors: [{ name: 'Gaspar' }],
  creator: 'Gaspar',

  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },

  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: siteUrl,
    siteName: 'Gaspar Labs',
    title: 'Gaspar Labs',
    description:
      'Research, systems, cybersecurity, IA e underground web.',
    images: [
      {
        url: '/icon.png',
        width: 512,
        height: 512,
        alt: 'Gaspar Labs',
      },
    ],
  },

  twitter: {
    card: 'summary',
    title: 'Gaspar Labs',
    description:
      'Research, systems, cybersecurity, IA e underground web.',
    images: ['/icon.png'],
  },

  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: [
    {
      media: '(prefers-color-scheme: dark)',
      color: '#08090b',
    },
    {
      media: '(prefers-color-scheme: light)',
      color: '#fafafa',
    },
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
      <body className="min-h-screen font-sans antialiased flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Header />

          <main className="flex-1">{children}</main>

          <Footer />

          <SearchWrapper />
        </ThemeProvider>

        {process.env.NODE_ENV === 'production' && <Analytics />}

        <PlausibleAnalytics
          domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
        />
      </body>
    </html>
  )
}