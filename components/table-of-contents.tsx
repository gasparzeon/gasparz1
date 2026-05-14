'use client'

import { useEffect, useState } from 'react'

type Heading = {
  id: string
  text: string
  level: number
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<
    Heading[]
  >([])

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll(
        'article h2, article h3'
      )
    )

    const items = elements.map((el) => ({
      id: el.id,
      text: el.textContent || '',
      level: Number(el.tagName[1]),
    }))

    setHeadings(items)
  }, [])

  if (headings.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Neste artigo
      </h3>

      <nav>
        <ul className="space-y-3 text-sm">
          {headings.map((heading) => (
            <li
              key={heading.id}
              className={
                heading.level === 3
                  ? 'ml-4'
                  : ''
              }
            >
              <a
                href={`#${heading.id}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}