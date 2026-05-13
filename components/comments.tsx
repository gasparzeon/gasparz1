'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'

interface CommentsProps {
  // Configure these in your Giscus settings at https://giscus.app
  repo?: `${string}/${string}`
  repoId?: string
  category?: string
  categoryId?: string
}

export function Comments({ 
  repo,
  repoId,
  category,
  categoryId,
}: CommentsProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted || !repo || !repoId || !category || !categoryId) return

    const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
    
    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.setAttribute('data-repo', repo)
    script.setAttribute('data-repo-id', repoId)
    script.setAttribute('data-category', category)
    script.setAttribute('data-category-id', categoryId)
    script.setAttribute('data-mapping', 'pathname')
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'bottom')
    script.setAttribute('data-theme', theme)
    script.setAttribute('data-lang', 'pt')
    script.setAttribute('data-loading', 'lazy')
    script.crossOrigin = 'anonymous'
    script.async = true

    const container = document.getElementById('giscus-container')
    if (container) {
      container.innerHTML = ''
      container.appendChild(script)
    }

    return () => {
      if (container) {
        container.innerHTML = ''
      }
    }
  }, [mounted, repo, repoId, category, categoryId, resolvedTheme])

  // Show placeholder if not configured
  if (!repo || !repoId || !category || !categoryId) {
    return (
      <div className="mt-16 rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Comentarios serao exibidos aqui apos configurar o Giscus.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Configure em{' '}
          <a 
            href="https://giscus.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            giscus.app
          </a>
          {' '}e adicione as props ao componente Comments.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-16">
      <h2 className="mb-8 text-2xl font-bold">Comentarios</h2>
      <div id="giscus-container" />
    </div>
  )
}
