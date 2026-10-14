import type { MetadataRoute } from 'next';

import { resolveSiteUrl } from '@/lib/site/schema';
import { getSiteSettings } from '@/lib/site/service';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = resolveSiteUrl(await getSiteSettings());

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },

    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
