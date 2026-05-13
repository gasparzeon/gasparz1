import Link from 'next/link'
import { Instagram, Rss } from 'lucide-react'

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
    <footer className="border-t border-border/50 py-8 mt-auto">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Gaspar - 2026
          </p>
          
          <div className="flex items-center gap-4">
            {socialLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={link.name}
              >
                <link.icon className="h-5 w-5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
