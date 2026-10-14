'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

import type { Post } from '@/lib/content';
import { SECTIONS, type SectionKey } from '@/lib/sections';
import { countBetween, staggerIn } from '@/lib/motion/gz-motion';
import { monthLabel, plural } from '@/lib/posts-view';

import { Breadcrumbs } from './breadcrumbs';
import { PostItem } from './post-item';
import { SectionSig } from './section-sig';

export type ArchivePost = Pick<
  Post,
  'slug' | 'title' | 'excerpt' | 'publishedAt' | 'readingTime' | 'section' | 'coverImage' | 'tags'
> & { number: string };

export type ArchiveFilters = {
  q: string;
  section: SectionKey | 'all';
  tag: string;
  order: 'desc' | 'asc';
};

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const pad2 = (n: number) => String(n).padStart(2, '0');

// Arquivo com busca, filtro por seção (e por etiqueta, vindo de um link),
// ordem e agrupamento por mês. Tudo no navegador: a lista inteira já veio
// do servidor. A URL acompanha os filtros, então dá para compartilhar.
export function ArchiveBrowser({
  posts,
  initial,
  title,
  description,
}: {
  posts: ArchivePost[];
  initial: ArchiveFilters;
  title: string;
  description: string;
}) {
  const [q, setQ] = useState(initial.q);
  const [section, setSection] = useState<ArchiveFilters['section']>(initial.section);
  const [tag, setTag] = useState(initial.tag);
  const [order, setOrder] = useState<ArchiveFilters['order']>(initial.order);
  const bigNum = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const shownCount = useRef<number | null>(null);
  const firstRender = useRef(true);
  const searchInput = useRef<HTMLInputElement>(null);

  const needle = fold(q.trim());
  const byQuery = useMemo(
    () =>
      posts.filter(
        (post) =>
          (!tag || post.tags.includes(tag)) &&
          (!needle ||
            fold(
              [
                post.title,
                post.excerpt,
                post.number,
                SECTIONS.find((s) => s.key === post.section)?.one ?? '',
                post.tags.join(' '),
              ].join(' '),
            ).includes(needle)),
      ),
    [posts, needle, tag],
  );

  const shown = useMemo(() => {
    const filtered = byQuery.filter((post) => section === 'all' || post.section === section);
    return order === 'asc' ? [...filtered].reverse() : filtered;
  }, [byQuery, section, order]);

  const groups = useMemo(() => {
    const out: { id: string; label: string; items: ArchivePost[] }[] = [];
    for (const post of shown) {
      const id = `mes-${post.publishedAt.slice(0, 7)}`;
      const last = out.at(-1);
      if (last && last.id === id) last.items.push(post);
      else out.push({ id, label: monthLabel(post.publishedAt), items: [post] });
    }
    return out;
  }, [shown]);

  const filtered = section !== 'all' || q.trim() !== '' || tag !== '';
  const activeSection = SECTIONS.find((s) => s.key === section);
  const summary =
    plural(shown.length, 'post', 'posts') +
    (activeSection ? ` em ${activeSection.many}` : '') +
    (tag ? ` com #${tag}` : '') +
    (q.trim() ? ` para “${q.trim()}”` : '');

  // Número grande rola até o novo total; a lista entra em cascata.
  useEffect(() => {
    if (shownCount.current !== null && shownCount.current !== shown.length) {
      countBetween(bigNum.current, shownCount.current, shown.length);
    }
    shownCount.current = shown.length;
  }, [shown.length]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (list.current) staggerIn(Array.from(list.current.querySelectorAll('[data-gz-row]')));
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (section !== 'all') params.set('secao', section);
    if (tag) params.set('tag', tag);
    if (order === 'asc') params.set('ordem', 'antigos');
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [q, section, tag, order]);

  const clearAll = () => {
    setQ('');
    setSection('all');
    setTag('');
  };

  const chips: { key: ArchiveFilters['section']; label: string; count: number }[] = [
    { key: 'all', label: 'Todas', count: byQuery.length },
    ...SECTIONS.map((s) => ({
      key: s.key,
      label: s.many,
      count: byQuery.filter((post) => post.section === s.key).length,
    })),
  ];

  const first = posts.at(-1);
  const last = posts[0];

  return (
    <div className="gz-root gz-page">
      {posts.length > 0 && (
        <div className="gz-slugs gz-slugs--top" aria-hidden="true" data-gz-scope="">
          {[0, 1, 2].map((row) => (
            <div key={row} className="gz-slug-row" data-gz-drift={row % 2 ? -1 : 1}>
              {posts
                .filter((_, index) => index % 3 === row)
                .map((post, index) => (
                  <span key={post.slug}>
                    {row === 0 && index === 0 ? <em>{post.slug}</em> : post.slug}
                    {' / '}
                  </span>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="gz-wrap" style={{ position: 'relative', zIndex: 1 }}>
        <Breadcrumbs items={[{ label: title }]} />
        <div className="gz-page-head">
          <div className="gz-status" data-gz-intro="">
            <span className="gz-live">
              <span className="gz-dot" aria-hidden="true" />
              índice do arquivo
            </span>
            <span>
              <b>{posts.length}</b> {posts.length === 1 ? 'post' : 'posts'}
            </span>
            <span>
              <b>{SECTIONS.filter((s) => posts.some((post) => post.section === s.key)).length}</b>{' '}
              seções
            </span>
            {first && last && (
              <span>
                {monthLabel(first.publishedAt).toLowerCase()} —{' '}
                {monthLabel(last.publishedAt).toLowerCase()}
              </span>
            )}
          </div>
          <h1 className="gz-h1" data-gz-scramble="intro">
            {title}
          </h1>
          <p className="gz-bignum" aria-hidden="true" data-gz-intro="">
            <span ref={bigNum}>{pad2(shown.length)}</span>
          </p>
          {description && (
            <p className="gz-lead" data-gz-intro="">
              {description}
            </p>
          )}
        </div>

        <section className="gz-filters" aria-label="Busca e filtros" data-gz-intro="">
          <div>
            <label className="gz-label" htmlFor="gz-busca">
              Buscar por título, assunto ou etiqueta
            </label>
            <div className="gz-searchbox">
              <Search className="gz-ico" aria-hidden="true" />
              <input
                ref={searchInput}
                id="gz-busca"
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Ex.: urnas, ransomware, Cicada"
                autoComplete="off"
              />
              {q && (
                <button
                  type="button"
                  className="gz-btn gz-btn--ghost gz-btn--sm"
                  onClick={() => {
                    setQ('');
                    searchInput.current?.focus();
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="gz-label" htmlFor="gz-ordem">
              Ordenar
            </label>
            <div className="gz-selectwrap">
              <select
                id="gz-ordem"
                className="gz-select"
                value={order}
                onChange={(event) => setOrder(event.target.value === 'asc' ? 'asc' : 'desc')}
              >
                <option value="desc">Mais recentes primeiro</option>
                <option value="asc">Mais antigos primeiro</option>
              </select>
              <ChevronDown className="gz-ico" aria-hidden="true" />
            </div>
          </div>
          <div className="gz-chips-wrap" role="group" aria-labelledby="gz-secao-t">
            <p id="gz-secao-t" className="gz-label">
              Filtrar por seção
            </p>
            <div className="gz-chips">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="gz-chip"
                  aria-pressed={section === chip.key}
                  onClick={() => setSection(chip.key)}
                >
                  {chip.key === 'all' ? (
                    <span aria-hidden="true" className="gz-sig gz-k-square" />
                  ) : (
                    <SectionSig section={chip.key} />
                  )}
                  <span>{chip.label}</span>
                  <span className="gz-chip-n">({chip.count})</span>
                </button>
              ))}
              {tag && (
                <button
                  type="button"
                  className="gz-chip"
                  aria-pressed={true}
                  onClick={() => setTag('')}
                  aria-label={`Remover filtro da etiqueta ${tag}`}
                >
                  #{tag}
                  <X className="gz-ico" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="gz-results">
          <p className="gz-query" aria-live="polite">
            <span aria-hidden="true">› </span>
            <b>{summary}</b>
          </p>
          {filtered && (
            <button type="button" className="gz-btn gz-btn--sm" onClick={clearAll}>
              Limpar filtros
            </button>
          )}
        </div>

        <div ref={list}>
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={group.id}>
              <h2 id={group.id} className="gz-month-h">
                {group.label}
                <span>{plural(group.items.length, 'post', 'posts')}</span>
              </h2>
              <ul className="gz-list">
                {group.items.map((post) => (
                  <PostItem key={post.slug} post={post} number={post.number} reveal={false} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {shown.length === 0 && (
          <div className="gz-empty">
            <p className="gz-h3">Nenhum post encontrado.</p>
            <p className="gz-small">
              Tente outra palavra, escolha outra seção ou limpe os filtros para ver tudo.
            </p>
            {filtered && (
              <button type="button" className="gz-btn gz-btn--primary" onClick={clearAll}>
                Limpar filtros
              </button>
            )}
          </div>
        )}

        <div style={{ height: '4rem' }} />
      </div>
    </div>
  );
}
