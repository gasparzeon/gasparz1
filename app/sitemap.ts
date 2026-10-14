import type { MetadataRoute } from 'next';

import { getAllPosts } from '@/lib/content';
import { listPublishedPages } from '@/lib/site/pages';
import { resolveSiteUrl } from '@/lib/site/schema';
import { getSiteSettings } from '@/lib/site/service';

// Regenerado quando um post ou página muda (revalidatePath) ou a cada 5 minutos.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, pages, settings] = await Promise.all([
    getAllPosts(),
    listPublishedPages(),
    getSiteSettings(),
  ]);
  const baseUrl = resolveSiteUrl(settings);

  const postUrls = posts.map((post) => ({
    url: `${baseUrl}/posts/${post.slug}`,
    lastModified: post.updatedAt
      ? new Date(post.updatedAt)
      : post.publishedAt
        ? new Date(post.publishedAt)
        : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const pageUrls = pages.map((page) => ({
    url: `${baseUrl}/${page.slug}`,
    lastModified: new Date(page.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/posts`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${baseUrl}/creators`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    ...pageUrls,
    ...postUrls,
  ];
}
