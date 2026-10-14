import Link from 'next/link';

import type { Post } from '@/lib/content';
import { getSection } from '@/lib/sections';
import { longDate, shapeClassFor } from '@/lib/posts-view';
import { cn } from '@/lib/utils';

import { SectionSig } from './section-sig';

type PostItemData = Pick<
  Post,
  'slug' | 'title' | 'excerpt' | 'publishedAt' | 'readingTime' | 'section' | 'coverImage'
>;

// Linha da lista de posts (início, arquivo, página de autor). O título é o
// link e cobre a linha inteira; a miniatura é a forma da seção (ou a capa).
export function PostItem({
  post,
  number,
  heading: Heading = 'h3',
  reveal = true,
}: {
  post: PostItemData;
  number?: string;
  heading?: 'h2' | 'h3';
  reveal?: boolean;
}) {
  const section = getSection(post.section);

  return (
    <li className="gz-item" data-gz-reveal={reveal ? '' : undefined} data-gz-row="">
      <div
        aria-hidden="true"
        className={cn('gz-thumb gz-cut', !post.coverImage && `gz-cv-${post.section ?? 'none'}`)}
      >
        {post.coverImage ? (
          <img src={post.coverImage} alt="" loading="lazy" />
        ) : (
          <span className={cn('gz-thumb-s', shapeClassFor(post.section))} />
        )}
      </div>
      <div>
        <p className="gz-item-meta">
          {section && (
            <span className="gz-item-sec">
              <SectionSig section={post.section} />
              {section.one}
            </span>
          )}
          {post.publishedAt && (
            <time dateTime={post.publishedAt}>{longDate(post.publishedAt)}</time>
          )}
          <span>{post.readingTime} de leitura</span>
          {number && <span className="gz-id">{number}</span>}
        </p>
        <Heading className="gz-item-title">
          <Link href={`/posts/${post.slug}`} data-gz-scramble="hover">
            {post.title}
          </Link>
        </Heading>
        {post.excerpt && <p className="gz-item-ex">{post.excerpt}</p>}
      </div>
    </li>
  );
}
