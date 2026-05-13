import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

const POSTS_DIR = path.join(process.cwd(), 'content/posts')

export type Post = {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  updatedAt: string
  tags: string[]
  draft: boolean
  coverImage: string | null
  readingTime: string
}

export type PostWithContent = Post & {
  content: string
}

function getPostFiles() {
  if (!fs.existsSync(POSTS_DIR)) return []

  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith('.mdx'))
}

export async function getAllPosts(): Promise<Post[]> {
  const files = getPostFiles()

  const posts = files.map((file) => {
    const slug = file.replace(/\.mdx$/, '')
    const filePath = path.join(POSTS_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(raw)
    const stats = readingTime(content)

    return {
      slug,
      title: data.title || slug,
      excerpt: data.excerpt || '',
      publishedAt: data.publishedAt || '',
      updatedAt: data.updatedAt || '',
      tags: data.tags || [],
      draft: data.draft ?? false,
      coverImage: data.coverImage || null,
      readingTime: stats.text.replace('min read', 'min'),
    }
  })

  return posts
    .filter((post) => post.draft === false)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    )
}

export async function getPostBySlug(
  slug: string
): Promise<PostWithContent | null> {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`)

  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  const stats = readingTime(content)

  return {
    slug,
    title: data.title || slug,
    excerpt: data.excerpt || '',
    publishedAt: data.publishedAt || '',
    updatedAt: data.updatedAt || '',
    tags: data.tags || [],
    draft: data.draft ?? false,
    coverImage: data.coverImage || null,
    readingTime: stats.text.replace('min read', 'min'),
    content,
  }
}

export async function getAllTags(): Promise<string[]> {
  const posts = await getAllPosts()

  return Array.from(new Set(posts.flatMap((post) => post.tags))).sort()
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getAllPosts()

  return posts.filter((post) => post.tags.includes(tag))
}