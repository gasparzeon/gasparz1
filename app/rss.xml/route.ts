import { getAllPosts } from '@/lib/content';
import { resolveSiteUrl } from '@/lib/site/schema';
import { getSiteSettings } from '@/lib/site/service';

// Regenerado quando um post muda (revalidatePath) ou a cada 5 minutos.
export const revalidate = 300;

const cdata = (value: string) => `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;

export async function GET() {
  const [posts, settings] = await Promise.all([getAllPosts(), getSiteSettings()]);
  const siteUrl = resolveSiteUrl(settings);

  const items = posts
    .map(
      (post) => `
    <item>
      <title>${cdata(post.title)}</title>
      <description>${cdata(post.excerpt)}</description>
      <link>${siteUrl}/posts/${post.slug}</link>
      <guid>${siteUrl}/posts/${post.slug}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
    </item>`,
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${cdata(settings.general.name)}</title>
    <description>${cdata(settings.general.description)}</description>
    <link>${siteUrl}</link>
    <language>pt-BR</language>${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
