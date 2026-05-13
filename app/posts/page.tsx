import type { Metadata } from 'next'
import { getAllPosts, getAllTags } from '@/lib/content'
import { PostCard } from '@/components/post-card'
import { TagFilter } from '@/components/tag-filter'

export const metadata: Metadata = {
  title: 'Posts',
  description: 'Todos os posts publicados.',
}

interface PostsPageProps {
  searchParams: Promise<{
    tag?: string
  }>
}

export default async function PostsPage({
  searchParams,
}: PostsPageProps) {
  const params = await searchParams

  const posts = await getAllPosts()
  const allTags = await getAllTags()

  const filteredPosts = params.tag
    ? posts.filter((post) =>
        post.tags.includes(params.tag!)
      )
    : posts

  return (
    <main className="container mx-auto max-w-4xl px-4 py-16">
      <header className="mb-12">
        <h1 className="mb-4">Posts</h1>

        <p className="text-lg text-muted-foreground">
          {filteredPosts.length}{' '}
          {filteredPosts.length === 1
            ? 'post publicado'
            : 'posts publicados'}
        </p>
      </header>

      {allTags.length > 0 && (
        <TagFilter
          tags={allTags}
          activeTag={params.tag}
          className="mb-8"
        />
      )}

      {filteredPosts.length > 0 ? (
        <div className="flex flex-col gap-6">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum post publicado ainda.
          </p>
        </div>
      )}
    </main>
  )
}