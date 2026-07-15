import Link from 'next/link'
import { Instagram, Rss, Heart } from 'lucide-react'

const socialLinks = [
  {
    name: 'Instagram',
    href: 'https://instagram.com/gasparzeon',
    icon: Instagram,
  },
  {
    name: 'RSS',
    href: '/rss.xml',
    icon: Rss,
  },
]

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/[0.03]">
      <div className="container mx-auto max-w-5xl px-6 py-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-300">
              © {new Date().getFullYear()} Gaspar Labs. Todos os direitos
              reservados.
            </p>

            <p className="mt-1.5 text-xs text-slate-500">
              Sem cookies de rastreio · Sem anúncios · Sem scripts invasivos
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex items-center gap-4">
              {socialLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={
                    link.href.startsWith('http')
                      ? 'noopener noreferrer'
                      : undefined
                  }
                  className="text-slate-500 transition-colors hover:text-white"
                  aria-label={link.name}
                >
                  <link.icon className="h-4 w-4" />
                </Link>
              ))}
            </div>

            <Link
              href="/support"
              className="group inline-flex items-center gap-2 text-xs text-slate-500 transition-colors hover:text-white"
            >
              <Heart className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
              Seja um apoiador
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}