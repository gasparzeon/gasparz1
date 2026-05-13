'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSearchStore } from '@/lib/search-store'

export function SearchTrigger() {
  const { setOpen } = useSearchStore()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [setOpen])

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setOpen(true)}
    >
      <Search className="h-4 w-4" />
      <span className="sr-only">Buscar (Cmd+K)</span>
    </Button>
  )
}
