'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TOCItem {
  id: string
  text: string
  level: number
}

export function TableOfContents() {
  const [headings, setHeadings] = React.useState<TOCItem[]>([])
  const [activeId, setActiveId] = React.useState<string>('')

  React.useEffect(() => {
    const article = document.querySelector('article')
    if (!article) return

    const elements = article.querySelectorAll('h2, h3')
    const items: TOCItem[] = Array.from(elements).map((el) => ({
      id: el.id,
      text: el.textContent || '',
      level: el.tagName === 'H2' ? 2 : 3,
    }))
    
    setHeadings(items)
  }, [])

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-80px 0px -80% 0px',
      }
    )

    headings.forEach(({ id }) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <nav className="text-sm">
      <p className="mb-4 font-medium text-foreground">Neste artigo</p>
      <ul className="space-y-2">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(heading.id)?.scrollIntoView({
                  behavior: 'smooth',
                })
              }}
              className={cn(
                'block transition-colors',
                heading.level === 3 && 'pl-4',
                activeId === heading.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
