import Link from 'next/link'
import { formatDate } from '@/lib/format'
import type { Post } from '@/lib/content'

interface PostCardProps {
  post: Post
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="group relative">
      <Link 
        href={`/posts/${post.slug}`}
        className="block rounded-lg border border-border bg-card p-6 transition-all duration-200 hover:border-accent/50 hover:bg-card/80"
      >
        <div className="flex flex-col gap-3">
          {/* Meta info */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt || undefined}>
              {post.publishedAt ? formatDate(post.publishedAt) : 'Sem data'}
            </time>
            <span className="text-border">•</span>
            <span>{post.readingTime}</span>
          </div>

          {/* Title */}
          <h3 className="font-serif text-xl font-bold transition-colors group-hover:text-accent md:text-2xl">
            {post.title}
          </h3>

          {/* Excerpt */}
          <p className="line-clamp-2 text-muted-foreground">
            {post.excerpt}
          </p>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {post.tags.map((tag) => (
                <span 
                  key={tag}
                  className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}
