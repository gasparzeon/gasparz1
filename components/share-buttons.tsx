'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface ShareButtonsProps {
  title: string
}

export function ShareButtons({ title }: ShareButtonsProps) {
  const [mounted, setMounted] = useState(false)
  const [url, setUrl] = useState('')

  useEffect(() => {
    setMounted(true)
    setUrl(window.location.href)
  }, [])

  // Evita hydration mismatch
  if (!mounted) {
    return null
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        Compartilhar:
      </span>

      <Button
        variant="ghost"
        size="icon"
        asChild
      >
        <a
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Compartilhar no Twitter"
        >
          X
        </a>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        asChild
      >
        <a
          href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Compartilhar no LinkedIn"
        >
          in
        </a>
      </Button>
    </div>
  )
}