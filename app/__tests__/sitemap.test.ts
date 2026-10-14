import { getAllPosts } from '@/lib/content';
import { listPublishedPages } from '@/lib/site/pages';
import { DEFAULT_SITE_SETTINGS } from '@/lib/site/schema';
import { getSiteSettings } from '@/lib/site/service';

import sitemap from '../sitemap';

jest.mock('@/lib/content', () => ({ getAllPosts: jest.fn() }));
jest.mock('@/lib/site/pages', () => ({ listPublishedPages: jest.fn() }));
jest.mock('@/lib/site/service', () => ({ getSiteSettings: jest.fn() }));

beforeEach(() => {
  jest.mocked(getSiteSettings).mockResolvedValue({
    ...DEFAULT_SITE_SETTINGS,
    general: { ...DEFAULT_SITE_SETTINGS.general, url: 'https://gaspar.vorn.fun' },
  });
  jest.mocked(getAllPosts).mockResolvedValue([
    {
      slug: 'h4ck34ndo-as-urnas',
      title: 'Urnas',
      excerpt: '',
      publishedAt: '2026-10-01',
      updatedAt: '',
      tags: [],
      section: null,
      draft: false,
      coverImage: null,
      readingTime: '8 min',
      author: { name: 'Gaspar', username: 'gaspar', avatarUrl: '', bio: '' },
    },
  ]);
  jest
    .mocked(listPublishedPages)
    .mockResolvedValue([{ slug: 'about', updatedAt: '2026-09-01T00:00:00.000Z' }] as Awaited<
      ReturnType<typeof listPublishedPages>
    >);
});

describe('sitemap', () => {
  it('início, arquivo, Creators, páginas e posts no endereço público do site', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toEqual([
      'https://gaspar.vorn.fun',
      'https://gaspar.vorn.fun/posts',
      'https://gaspar.vorn.fun/creators',
      'https://gaspar.vorn.fun/about',
      'https://gaspar.vorn.fun/posts/h4ck34ndo-as-urnas',
    ]);
  });

  it('post sem data de atualização usa a de publicação', async () => {
    const post = (await sitemap()).find((entry) => entry.url.endsWith('/h4ck34ndo-as-urnas'));
    expect(post?.lastModified).toEqual(new Date('2026-10-01'));
  });
});
