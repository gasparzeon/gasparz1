import { createReader } from '@keystatic/core/reader'
import config from '@/keystatic.config'
import readingTime from 'reading-time'

const reader = createReader(process.cwd(), config)

export type Post = {
  slug: string
  title: string
  excerpt: string
  publishedAt: string | null
  updatedAt: string | null
  tags: readonly string[]
  draft: boolean
  coverImage: string | null
  readingTime: string
}

export type PostWithContent = Post & {
  content: string
}

export async function getAllPosts(): Promise<Post[]> {
  const posts =
    await reader.collections.posts.all()

  const postsWithMeta = posts.map((post) => {
    // MDX já vem como string
    const content =
      typeof post.entry.content === 'string'
        ? post.entry.content
        : ''

    const stats = readingTime(content)

    return {
      slug: post.slug,

      title: post.entry.title,

      excerpt: post.entry.excerpt,

      publishedAt:
        post.entry.publishedAt,

      updatedAt:
        post.entry.updatedAt || null,

      tags: post.entry.tags || [],

      draft:
        post.entry.draft || false,

      coverImage:
        post.entry.coverImage || null,

      readingTime: stats.text.replace(
        'min read',
        'min'
      ),
    }
  })

  return postsWithMeta
    .filter((post) => !post.draft)
    .sort((a, b) => {
      if (
        !a.publishedAt ||
        !b.publishedAt
      )
        return 0

      return (
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
      )
    })
}

export async function getPostBySlug(
  slug: string
): Promise<PostWithContent | null> {
  const post =
    await reader.collections.posts.read(slug)

  if (!post) return null

  const content =
    typeof post.content === 'string'
      ? post.content
      : ''

  const stats = readingTime(content)

  return {
    slug,

    title: post.title,

    excerpt: post.excerpt,

    publishedAt: post.publishedAt,

    updatedAt: post.updatedAt || null,

    tags: post.tags || [],

    draft: post.draft || false,

    coverImage: post.coverImage || null,

    readingTime: stats.text.replace(
      'min read',
      'min'
    ),

    content,
  }
}

export async function getAllTags(): Promise<
  string[]
> {
  const posts = await getAllPosts()

  const tagsSet = new Set<string>()

  posts.forEach((post) => {
    post.tags.forEach((tag) =>
      tagsSet.add(tag)
    )
  })

  return Array.from(tagsSet).sort()
}

export async function getPostsByTag(
  tag: string
): Promise<Post[]> {
  const posts = await getAllPosts()

  return posts.filter((post) =>
    post.tags.includes(tag)
  )
}