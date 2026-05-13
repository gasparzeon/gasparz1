'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Search, FileText, Tag, User, X } from 'lucide-react'
import { useSearchStore } from '@/lib/search-store'
import type { Post } from '@/lib/content'

interface SearchDialogProps {
  posts: Post[]
  tags: string[]
}

export function SearchDialog({ posts, tags }: SearchDialogProps) {
  const router = useRouter()
  const { open, setOpen } = useSearchStore()
  const [search, setSearch] = React.useState('')

  const filteredPosts = posts.filter((post) =>
    post.title.toLowerCase().includes(search.toLowerCase()) ||
    post.excerpt.toLowerCase().includes(search.toLowerCase())
  )

  const filteredTags = tags.filter((tag) =>
    tag.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (href: string) => {
    setOpen(false)
    setSearch('')
    router.push(href)
  }

  React.useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      
      {/* Dialog */}
      <div className="fixed left-1/2 top-[20%] w-full max-w-lg -translate-x-1/2 px-4">
        <Command
          className="rounded-lg border border-border bg-popover shadow-2xl"
          shouldFilter={false}
        >
          {/* Input */}
          <div className="flex items-center border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar posts, tags..."
              className="flex h-12 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </Command.Empty>

            {/* Quick Actions */}
            {!search && (
              <Command.Group heading="Navegacao">
                <Command.Item
                  value="posts"
                  onSelect={() => handleSelect('/posts')}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-secondary"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Todos os Posts</span>
                </Command.Item>
                <Command.Item
                  value="about"
                  onSelect={() => handleSelect('/about')}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-secondary"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Sobre</span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Posts */}
            {filteredPosts.length > 0 && (
              <Command.Group heading="Posts">
                {filteredPosts.slice(0, 5).map((post) => (
                  <Command.Item
                    key={post.slug}
                    value={post.title}
                    onSelect={() => handleSelect(`/posts/${post.slug}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-secondary"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{post.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {post.excerpt}
                      </p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Tags */}
            {filteredTags.length > 0 && (
              <Command.Group heading="Tags">
                {filteredTags.map((tag) => (
                  <Command.Item
                    key={tag}
                    value={tag}
                    onSelect={() => handleSelect(`/posts?tag=${tag}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-secondary"
                  >
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span>{tag}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">↵</kbd>
              <span>selecionar</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">esc</kbd>
              <span>fechar</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  )
}
