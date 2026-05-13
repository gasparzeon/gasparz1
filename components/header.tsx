'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { SearchTrigger } from '@/components/search-trigger'

const navigation = [
  { name: 'Posts', href: '/posts' },
  { name: 'Sobre', href: '/about' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
        <Link 
          href="/" 
          className="font-serif text-xl font-bold tracking-tight transition-colors hover:text-accent"
        >
          Gaspar
        </Link>

        <nav className="flex items-center gap-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors rounded-md',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'text-foreground bg-secondary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              {item.name}
            </Link>
          ))}
          
          <div className="ml-2 flex items-center gap-1 border-l border-border pl-3">
            <SearchTrigger />
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  )
}
