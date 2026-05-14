import { getAllPosts } from '@/lib/content'

export async function GET() {
  const posts = await getAllPosts()
  const siteUrl = 'https://gaspar-blog.vercel.app'

  const items = posts
    .map((post) => {
      return `
        <item>
          <title><![CDATA[${post.title}]]></title>
          <description><![CDATA[${post.excerpt}]]></description>
          <link>${siteUrl}/posts/${post.slug}</link>
          <guid>${siteUrl}/posts/${post.slug}</guid>
          <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
        </item>
      `
    })
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Gaspar Blog</title>
    <description>Research, systems, cybersecurity e underground web.</description>
    <link>${siteUrl}</link>
    <language>pt-BR</language>
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}