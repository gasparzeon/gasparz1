'use client'

import * as React from 'react'

export function ReadingProgress() {
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const updateProgress = () => {
      const article = document.querySelector('article')
      if (!article) return

      const articleRect = article.getBoundingClientRect()
      const articleTop = articleRect.top + window.scrollY
      const articleHeight = articleRect.height
      const windowHeight = window.innerHeight
      const scrollY = window.scrollY

      // Calculate progress based on how much of the article has been scrolled through
      const start = articleTop - windowHeight
      const end = articleTop + articleHeight - windowHeight
      const current = scrollY - start
      const total = end - start

      const percentage = Math.min(Math.max((current / total) * 100, 0), 100)
      setProgress(percentage)
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  return (
    <div
      className="reading-progress"
      style={{ width: `${progress}%` }}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso de leitura"
    />
  )
}
