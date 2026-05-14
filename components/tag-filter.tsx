'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagFilterProps {
  tags: string[]
  activeTag?: string
  className?: string
}

const PRIORITY_TAGS = [
  'cybersecurity',
  'ia',
  'tecnologia',
  'filosofia',
  'hacking',
  'sistemas',
  'internet',
  'ciência',
]

export function TagFilter({
  tags,
  activeTag,
  className,
}: TagFilterProps) {
  const [open, setOpen] = useState(false)

  const sortedTags = [...tags].sort((a, b) => {
    const aIndex = PRIORITY_TAGS.indexOf(a)
    const bIndex = PRIORITY_TAGS.indexOf(b)

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1

    return a.localeCompare(b)
  })

  const visibleTags = sortedTags.slice(0, 8)
  const hiddenTags = sortedTags.slice(8)

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/posts"
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors',
            !activeTag
              ? 'bg-white text-black'
              : 'bg-white/[0.04] text-slate-500 hover:text-white'
          )}
        >
          Todos
        </Link>

        {visibleTags.map((tag) => (
          <Link
            key={tag}
            href={`/posts?tag=${tag}`}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              activeTag === tag
                ? 'bg-white text-black'
                : 'bg-white/[0.04] text-slate-500 hover:text-white'
            )}
          >
            {tag}
          </Link>
        ))}

        {hiddenTags.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-3 py-1.5 text-sm text-slate-500 transition-colors hover:text-white"
          >
            {open ? (
              <>
                <X className="h-4 w-4" />
                Fechar
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {hiddenTags.length}
              </>
            )}
          </button>
        )}
      </div>

      {open && hiddenTags.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-600">
            Arquivo de tags
          </p>

          <div className="flex flex-wrap gap-2">
            {hiddenTags.map((tag) => (
              <Link
                key={tag}
                href={`/posts?tag=${tag}`}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  activeTag === tag
                    ? 'bg-white text-black'
                    : 'bg-black/30 text-slate-500 hover:text-white'
                )}
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}