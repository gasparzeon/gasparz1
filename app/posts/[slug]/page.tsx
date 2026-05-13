import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getAllPosts, getPostBySlug } from '@/lib/content'
import { formatDate } from '@/lib/format'

import { PostContent } from '@/components/post-content'
import { TableOfContents } from '@/components/table-of-contents'
import { ShareButtons } from '@/components/share-buttons'
import { ReadingProgress } from '@/components/reading-progress'
import { Comments } from '@/components/comments'

interface PostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const posts = await getAllPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) return {}

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt || undefined,
      tags: post.tags as string[],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  }
}

export default async function PostPage({
  params,
}: PostPageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return (
    <>
      <ReadingProgress />

      <article className="container mx-auto max-w-4xl px-4 py-16">
        <Link
          href="/posts"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para posts
        </Link>

        <header className="mb-12">
          {post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/posts?tag=${tag}`}
                  className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          <h1 className="mb-4">{post.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt || undefined}>
              {post.publishedAt
                ? formatDate(post.publishedAt)
                : 'Sem data'}
            </time>

            <span className="text-border">•</span>

            <span>{post.readingTime} de leitura</span>

            {post.updatedAt && (
              <>
                <span className="text-border">•</span>
                <span>
                  Atualizado em {formatDate(post.updatedAt)}
                </span>
              </>
            )}
          </div>
        </header>

        <div className="relative lg:grid lg:grid-cols-[1fr_200px] lg:gap-12">
          <div className="prose prose-invert max-w-none">
            <PostContent content={post.content} />
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TableOfContents />
            </div>
          </aside>
        </div>

        <Comments />

        <footer className="mt-16 border-t border-border pt-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <ShareButtons title={post.title} />

            <Link
              href="/posts"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver todos os posts
            </Link>
          </div>
        </footer>
      </article>
    </>
  )
}