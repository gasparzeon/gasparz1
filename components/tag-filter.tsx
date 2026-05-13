'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface TagFilterProps {
  tags: string[]
  activeTag?: string
  className?: string
}

export function TagFilter({ tags, activeTag, className }: TagFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleTagClick = (tag: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (tag) {
      params.set('tag', tag)
    } else {
      params.delete('tag')
    }

    router.push(`/posts?${params.toString()}`)
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <button
        onClick={() => handleTagClick(null)}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm transition-colors',
          !activeTag
            ? 'bg-foreground text-background'
            : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
        )}
      >
        Todos
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => handleTagClick(tag)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors',
            activeTag === tag
              ? 'bg-foreground text-background'
              : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
