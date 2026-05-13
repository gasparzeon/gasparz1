import { getAllPosts } from '@/lib/content'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export async function GET() {
  const posts = await getAllPosts()

  const itemsXml = posts
    .map(
      (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE_URL}/posts/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/posts/${post.slug}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${post.publishedAt ? new Date(post.publishedAt).toUTCString() : ''}</pubDate>
      ${post.tags.map((tag) => `<category>${tag}</category>`).join('\n      ')}
    </item>`
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Gaspar - 2026</title>
    <link>${BASE_URL}</link>
    <description>Um espaco para pensar em voz alta sobre o craft de construir e entender sistemas.</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    ${itemsXml}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
