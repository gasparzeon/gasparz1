import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';

import { getCreators } from '@/lib/content';
import { plural, shortDate } from '@/lib/posts-view';
import { getSection } from '@/lib/sections';
import { AuthorAvatar } from '@/components/author-avatar';
import { Breadcrumbs } from '@/components/site/breadcrumbs';
import { SectionSig } from '@/components/site/section-sig';
import { SocialConnections } from '@/components/site/social-connections';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Creators',
  description: 'Quem pesquisa, investiga e escreve o arquivo, com as redes de cada pessoa.',
};

// Aba "Creators": quem escreve no arquivo, com bio, números, seções e as
// redes de cada pessoa (como as conexões do Discord).
export default async function CreatorsPage() {
  const creators = await getCreators();

  return (
    <div className="gz-root">
      <div className="gz-wrap">
        <Breadcrumbs items={[{ label: 'Creators' }]} />

        <header className="grid gap-3 py-8 lg:py-12">
          <p className="gz-kicker" data-gz-intro="">
            <b>~/</b>creators
          </p>
          <h1 className="gz-h1" data-gz-scramble="intro">
            Creators
          </h1>
          <p className="gz-lead" data-gz-intro="">
            Quem pesquisa, investiga e escreve o arquivo. Siga cada pessoa nas redes dela.
          </p>
        </header>

        <div className="gz-results">
          <p className="gz-query">
            <span aria-hidden="true">› </span>
            <b>{plural(creators.length, 'creator', 'creators')}</b>
          </p>
        </div>

        {creators.length > 0 ? (
          <ul className="gz-creators">
            {creators.map((creator) => (
              <li key={creator.username} data-gz-reveal="">
                <article
                  className="gz-panel gz-creator"
                  aria-labelledby={`creator-${creator.username}`}
                >
                  <div className="gz-creator-head">
                    <AuthorAvatar author={creator} size={64} className="text-xl" />
                    <div className="min-w-0">
                      <h2 id={`creator-${creator.username}`} className="gz-creator-name">
                        <Link href={`/autores/${creator.username}`} data-gz-scramble="hover">
                          {creator.name}
                        </Link>
                      </h2>
                      <p className="gz-creator-user">@{creator.username}</p>
                    </div>
                  </div>

                  {creator.bio && <p className="gz-creator-bio">{creator.bio}</p>}

                  <p className="gz-creator-stats">
                    <span>
                      <b>{creator.posts}</b> {creator.posts === 1 ? 'post' : 'posts'}
                    </span>
                    {creator.latest && (
                      <span>
                        último: <time dateTime={creator.latest}>{shortDate(creator.latest)}</time>
                      </span>
                    )}
                  </p>

                  {creator.sections.length > 0 && (
                    <ul className="gz-creator-secs" aria-label="Escreve em">
                      {creator.sections.map((key) => (
                        <li key={key}>
                          <span className="gz-badge">
                            <SectionSig section={key} />
                            {getSection(key)?.many}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <SocialConnections socials={creator.socials} owner={creator.name} compact />

                  {creator.readme && (
                    <Link
                      className="gz-textlink gz-creator-readme"
                      href={`/autores/${creator.username}#readme`}
                    >
                      <FileText className="gz-ico" aria-hidden="true" />
                      Ler o README<span className="gz-sr"> de {creator.name}</span>
                    </Link>
                  )}
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <div className="gz-empty">
            <p className="gz-h3">Ninguém por aqui ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
