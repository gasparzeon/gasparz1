export async function getAllPosts(): Promise<Post[]> {
  const posts =
    await reader.collections.posts.all()

  const postsWithMeta = await Promise.all(
    posts.map(async (post) => {
      const content =
        await post.entry.content()

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
        readingTime:
          stats.text.replace(
            'min read',
            'min'
          ),
      }
    })
  )

  return postsWithMeta
    .filter((post) => !post.draft)
    .sort((a, b) => {
      if (
        !a.publishedAt ||
        !b.publishedAt
      )
        return 0

      return (
        new Date(
          b.publishedAt
        ).getTime() -
        new Date(
          a.publishedAt
        ).getTime()
      )
    })
}