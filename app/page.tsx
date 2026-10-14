import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, Search } from 'lucide-react';

import { getAllPosts, getAllTags, type Post } from '@/lib/content';
import { getSiteSettings } from '@/lib/site/service';
import { getSection, SECTIONS } from '@/lib/sections';
import {
  longDate,
  minutesOf,
  plural,
  registryNumbers,
  sectionCounts,
  shortDate,
  shortTitle,
} from '@/lib/posts-view';
import { LiveClock } from '@/components/site/live-clock';
import { PostCover } from '@/components/site/post-cover';
import { PostItem } from '@/components/site/post-item';
import { SectionSig } from '@/components/site/section-sig';
import { Highlight, StarMarks, hexDump } from '@/components/site/text';
import { Ticker } from '@/components/site/ticker';

// Regenerado quando um post muda (revalidatePath) ou a cada 5 minutos.
export const revalidate = 300;

// Endereços dos posts como textura de fundo, em até 5 linhas.
function slugRows(posts: Post[]) {
  const rows: string[][] = [[], [], [], [], []];
  posts.forEach((post, index) => rows[index % rows.length]?.push(post.slug));
  return rows.filter((row) => row.length > 0);
}

function Mesa({
  posts,
  numbers,
  siteName,
  tagCount,
}: {
  posts: Post[];
  numbers: Map<string, string>;
  siteName: string;
  tagCount: number;
}) {
  const latest = posts.slice(0, 5);
  // A ficha mostra um post antigo que mereça ser lembrado (de preferência um arquivo digital).
  const ficha =
    posts.find((post, index) => index > 0 && post.section === 'arquivos') ?? posts[1] ?? posts[0];
  const fichaSection = getSection(ficha?.section);
  const hex = hexDump(`${siteName.toUpperCase()} ARQUIVO VIVO`.padEnd(24, '.'));
  const usedSections = SECTIONS.filter((section) => posts.some((p) => p.section === section.key));

  return (
    <div className="gz-mesa gz-frame" aria-hidden="true">
      <span className="gz-frame-label">fig. 00 · mesa de trabalho</span>

      <div className="gz-fpos gz-m-s3" data-gz-speed="0.2">
        <div data-gz-depth="0.3" className="gz-fill">
          <i className="gz-fill gz-fill-ring" data-gz-pop="" />
        </div>
      </div>
      <div className="gz-fpos gz-m-s1" data-gz-speed="0.5">
        <div data-gz-depth="0.5" className="gz-fill">
          <i className="gz-fill gz-k-circle gz-fill-lime" data-gz-pop="" />
        </div>
      </div>

      <div className="gz-fpos gz-m-term" data-gz-speed="0.35">
        <div data-gz-depth="0.6">
          <div className="gz-frag gz-term gz-cut" data-gz-pop="" style={{ rotate: '-1.5deg' }}>
            <div className="gz-term-bar">
              <i className="gz-k-circle" />
              <i className="gz-k-square" />
              <i className="gz-k-tri" />
              <span>{siteName.toLowerCase().replace(/\s+/g, '')}: ~/arquivo</span>
            </div>
            <div className="gz-term-body" data-gz-type="">
              <span className="gz-term-line" data-gz-tline="" data-gz-cmd="">
                <span className="p">$ </span>ls -t posts | head -{latest.length}
              </span>
              {latest.map((post) => (
                <span key={post.slug} className="gz-term-line" data-gz-tline="">
                  <span className="d">{post.publishedAt} </span>
                  {getSection(post.section)?.code ?? '---'} {post.slug}
                </span>
              ))}
              <span className="gz-term-line" data-gz-tline="" data-gz-cmd="">
                <span className="p">$ </span>
                <span className="gz-caret" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="gz-fpos gz-m-s2" data-gz-speed="1.3" data-gz-rotate="50">
        <div data-gz-depth="1.8" className="gz-fill">
          <i className="gz-fill gz-k-square gz-fill-ink" data-gz-pop="" />
        </div>
      </div>
      <div className="gz-fpos gz-m-s4" data-gz-speed="0.9" data-gz-rotate="-40">
        <div data-gz-depth="1.2" className="gz-fill">
          <i className="gz-fill gz-k-tri gz-fill-ink" data-gz-pop="" />
        </div>
      </div>

      {ficha && (
        <div className="gz-fpos gz-m-ficha" data-gz-speed="0.7">
          <div data-gz-depth="1.1">
            <div
              className="gz-frag gz-ficha-card gz-cut"
              data-gz-pop=""
              style={{ rotate: '3.5deg' }}
            >
              <div className="gz-ficha-top">
                <span>{numbers.get(ficha.slug)}</span>
                <span>{fichaSection?.one.toLowerCase() ?? 'arquivo'}</span>
              </div>
              <b>{shortTitle(ficha.title)}</b>
              <p>{ficha.excerpt}</p>
            </div>
          </div>
        </div>
      )}

      <div className="gz-fpos gz-m-receipt" data-gz-speed="0.45">
        <div data-gz-depth="0.8">
          <div className="gz-frag gz-receipt gz-cut" data-gz-pop="" style={{ rotate: '-4deg' }}>
            <p>registro do arquivo</p>
            <hr />
            <p>posts publicados</p>
            <p className="gz-receipt-big">{posts.length}</p>
            <hr />
            <p>{plural(usedSections.length, 'seção', 'seções')}</p>
            <p>{plural(tagCount, 'etiqueta', 'etiquetas')}</p>
            {posts[0] && <p>último: {shortDate(posts[0].publishedAt)}</p>}
          </div>
        </div>
      </div>

      <div className="gz-fpos gz-m-hex" data-gz-speed="1">
        <div data-gz-depth="1.5">
          <div className="gz-frag gz-hexcard gz-cut" data-gz-pop="" style={{ rotate: '-2deg' }}>
            {hex.map((row) => (
              <span key={row.offset}>
                {row.offset} {row.hex} <b>{row.ascii}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [posts, tags, settings] = await Promise.all([
    getAllPosts(),
    getAllTags(),
    getSiteSettings(),
  ]);
  const home = settings.home;
  const numbers = registryNumbers(posts);
  const counts = sectionCounts(posts);
  const [featured, ...others] = posts;
  const recent = others.slice(0, home.recentCount);
  const totalMinutes = posts.reduce((sum, post) => sum + minutesOf(post.readingTime), 0);
  const first = posts.at(-1);
  const featuredSection = getSection(featured?.section);
  const rssLink = settings.social.find((link) => link.network === 'rss');
  const checks = settings.footer.note
    .split('·')
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="gz-root">
      <section className="gz-hero" data-gz-scope="" data-gz-tilt="" aria-labelledby="gz-hero-t">
        {posts.length > 0 && (
          <div className="gz-slugs" aria-hidden="true" data-gz-depth="0.25">
            {slugRows(posts).map((row, index) => (
              <div key={index} className="gz-slug-row" data-gz-drift={index % 2 ? -1 : 1}>
                {row.map((slug, i) => (
                  <span key={slug}>
                    {i === 0 && index === 0 ? <em>{slug}</em> : slug}
                    {' / '}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="gz-scan" data-gz-scan="" aria-hidden="true" />

        <div className="gz-wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div className="gz-status" data-gz-intro="">
            <span className="gz-live">
              <span className="gz-dot" aria-hidden="true" />
              arquivo aberto
            </span>
            <span>
              <b>{posts.length}</b> {posts.length === 1 ? 'post' : 'posts'}
            </span>
            {featured && (
              <span>
                último: <b>{shortDate(featured.publishedAt)}</b>
              </span>
            )}
            <span className="gz-sm-up">
              agora: <LiveClock />
            </span>
          </div>

          <div className="gz-hero-grid">
            <div className="gz-hero-in">
              {home.kicker && (
                <p className="gz-kicker" data-gz-intro="">
                  <b>~/</b>
                  {home.kicker}
                </p>
              )}
              <h1 id="gz-hero-t" className="gz-h1" data-gz-scramble="intro">
                <Highlight text={home.title} accent={home.titleAccent} />
              </h1>
              {home.lead && (
                <p className="gz-lead" data-gz-intro="">
                  {home.lead}
                </p>
              )}
              {home.topics.length > 0 && (
                <ul className="gz-topics" aria-label="Temas" data-gz-intro="">
                  {home.topics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
              )}
              <form action="/posts" role="search" data-gz-intro="">
                <label className="gz-label" htmlFor="gz-busca-inicio">
                  Buscar no arquivo
                </label>
                <div className="gz-searchbox">
                  <Search className="gz-ico" aria-hidden="true" />
                  <input
                    id="gz-busca-inicio"
                    name="q"
                    type="search"
                    placeholder="Ex.: urnas, ransomware, Cicada"
                  />
                  <button type="submit" className="gz-btn gz-btn--primary gz-btn--sm">
                    Buscar
                  </button>
                </div>
              </form>
              <div className="gz-hero-links" data-gz-intro="">
                <Link className="gz-textlink" href="/posts">
                  Ver todos os posts ({posts.length})
                </Link>
                <Link className="gz-textlink" href="#secoes">
                  Explorar por seção
                </Link>
              </div>
            </div>

            {posts.length > 0 && (
              <Mesa
                posts={posts}
                numbers={numbers}
                siteName={settings.general.name}
                tagCount={tags.length}
              />
            )}
          </div>

          {posts.length > 0 && (
            <div className="gz-stats">
              <div className="gz-stat" data-gz-reveal="">
                <b>
                  <span data-gz-count={posts.length}>{posts.length}</span>
                </b>
                <span>{posts.length === 1 ? 'post publicado' : 'posts publicados'}</span>
              </div>
              <div className="gz-stat" data-gz-reveal="">
                <b>
                  <span data-gz-count={SECTIONS.filter((s) => counts[s.key] > 0).length}>
                    {SECTIONS.filter((s) => counts[s.key] > 0).length}
                  </span>
                </b>
                <span>seções do arquivo</span>
              </div>
              <div className="gz-stat" data-gz-reveal="">
                <b>
                  <span data-gz-count={totalMinutes}>{totalMinutes}</span> min
                </b>
                <span>de leitura no total</span>
              </div>
              {first && (
                <div className="gz-stat" data-gz-reveal="">
                  <b>{shortDate(first.publishedAt).slice(3)}</b>
                  <span>primeiro post</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {posts.length > 0 && (
        <Ticker
          items={posts.slice(0, 8).map((post) => ({
            id: post.slug,
            number: numbers.get(post.slug) ?? '',
            title: shortTitle(post.title),
            section: post.section,
          }))}
        />
      )}

      {featured ? (
        <section className="gz-section" data-gz-scope="" aria-labelledby="gz-dest-t">
          <div className="gz-wrap">
            <div className="gz-section-head">
              <div>
                <p className="gz-kicker">
                  <b>01</b>na mesa agora
                </p>
                <h2 id="gz-dest-t" className="gz-h2" data-gz-scramble="">
                  Post mais recente
                </h2>
              </div>
            </div>
            <article className="gz-feature" data-gz-reveal="">
              <PostCover
                section={featured.section}
                image={featured.coverImage}
                tag={`${numbers.get(featured.slug)} · fig. 01`}
              />
              <div className="gz-feature-body">
                <p className="gz-meta">
                  {featuredSection && (
                    <span className="gz-badge">
                      <SectionSig section={featured.section} />
                      {featuredSection.one}
                    </span>
                  )}
                  <span className="gz-id">{numbers.get(featured.slug)}</span>
                </p>
                <h3 className="gz-feature-title">
                  <Link href={`/posts/${featured.slug}`} data-gz-scramble="hover">
                    {featured.title}
                  </Link>
                </h3>
                {featured.excerpt && <p className="gz-feature-ex">{featured.excerpt}</p>}
                <p className="gz-meta">
                  <span>Por {featured.author.name}</span>
                  <time dateTime={featured.publishedAt}>{longDate(featured.publishedAt)}</time>
                  <span>{featured.readingTime} de leitura</span>
                </p>
                <span className="gz-fake-btn" aria-hidden="true">
                  Ler o post
                  <ArrowRight className="gz-ico" />
                </span>
              </div>
            </article>
          </div>
        </section>
      ) : (
        <section className="gz-section">
          <div className="gz-wrap">
            <div className="gz-empty">
              <p className="gz-h3">{home.emptyText}</p>
              <a href="/admin/posts/new" className="gz-btn gz-btn--primary">
                Criar o primeiro post
              </a>
            </div>
          </div>
        </section>
      )}

      <section
        className="gz-section"
        id="secoes"
        aria-labelledby="gz-sec-t"
        style={{ paddingTop: 0 }}
      >
        <div className="gz-wrap">
          <div className="gz-section-head">
            <div>
              <p className="gz-kicker">
                <b>02</b>seções
              </p>
              <h2 id="gz-sec-t" className="gz-h2" data-gz-scramble="">
                Explore por seção
              </h2>
              <p>
                Cada seção tem uma forma. Ela acompanha os posts no site inteiro, então você sempre
                sabe onde está.
              </p>
            </div>
          </div>
          <div className="gz-secs">
            {SECTIONS.map((section) => (
              <Link
                key={section.key}
                className="gz-sec-card"
                href={`/posts?secao=${section.key}`}
                data-gz-reveal=""
              >
                <span className="gz-sec-ico gz-cut" aria-hidden="true">
                  <SectionSig section={section.key} />
                </span>
                <span>
                  <span className="gz-sec-name">{section.many}</span>
                  <span className="gz-sec-desc">{section.description}</span>
                  <span className="gz-sec-count">
                    {plural(counts[section.key], 'post', 'posts')}
                  </span>
                </span>
                <ChevronRight className="gz-ico" aria-hidden="true" />
              </Link>
            ))}
            <Link className="gz-sec-card gz-sec-card--all" href="/posts" data-gz-reveal="">
              <span className="gz-sec-ico gz-cut" aria-hidden="true">
                <span className="gz-sig gz-k-square" />
              </span>
              <span>
                <span className="gz-sec-name">Todos os posts</span>
                <span className="gz-sec-desc">O arquivo completo, com busca e filtros.</span>
                <span className="gz-sec-count">{plural(posts.length, 'post', 'posts')}</span>
              </span>
              <ChevronRight className="gz-ico" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="gz-section" aria-labelledby="gz-rec-t" style={{ paddingTop: 0 }}>
          <div className="gz-wrap">
            <div className="gz-section-head">
              <div>
                {home.recentKicker && (
                  <p className="gz-kicker">
                    <b>03</b>
                    {home.recentKicker}
                  </p>
                )}
                <h2 id="gz-rec-t" className="gz-h2" data-gz-scramble="">
                  {home.recentTitle || 'Posts recentes'}
                </h2>
              </div>
              {home.viewAllLabel && (
                <Link className="gz-textlink" href="/posts">
                  {home.viewAllLabel}
                </Link>
              )}
            </div>
            <ul className="gz-list">
              {recent.map((post) => (
                <PostItem key={post.slug} post={post} number={numbers.get(post.slug)} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {(home.about || checks.length > 0) && (
        <section
          className="gz-section"
          id="sobre"
          aria-labelledby="gz-sobre-t"
          style={{ paddingTop: 0 }}
        >
          <div className="gz-wrap">
            <div className="gz-about" data-gz-reveal="">
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                <p className="gz-kicker">
                  <b>04</b>sobre
                </p>
                <h2 id="gz-sobre-t" className="gz-sr">
                  Sobre o {settings.general.name}
                </h2>
                {home.about && (
                  <p className="gz-about-text">
                    <StarMarks text={home.about} />
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                {checks.length > 0 && (
                  <ul className="gz-checks">
                    {checks.map((item) => (
                      <li key={item}>
                        <span className="gz-ok" aria-hidden="true">
                          <Check className="gz-ico" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {rssLink && (
                  <div>
                    <a className="gz-btn" href={rssLink.url}>
                      Assinar via RSS
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
