import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { getAllPosts } from '@/lib/content'
import { PostCard } from '@/components/post-card'

export default async function HomePage() {
  const posts = await getAllPosts()

  const recentPosts = posts.slice(0, 4)

  return (
    <main className="container mx-auto max-w-5xl px-6 py-20 md:py-28">
      {/* HERO */}
      <section className="relative mb-32">
        {/* Small label */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px w-12 bg-white/10" />

          <span className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Research Archive
          </span>
        </div>

        {/* Main heading */}
        <div className="relative">
          <h1 className="max-w-5xl text-6xl font-black leading-[0.9] tracking-[-0.08em] text-white md:text-8xl">
            Gaspar
            <span className="ml-4 text-slate-600">
              2026
            </span>
          </h1>

          {/* glow */}
          <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-slate-500/10 blur-3xl" />
        </div>

        {/* Description */}
        <div className="mt-10 grid gap-12 md:grid-cols-[120px_1fr]">
          <div className="hidden md:block">
            <div className="flex h-full justify-center">
              <div className="w-px bg-white/10" />
            </div>
          </div>

          <div className="max-w-3xl">
            <p className="text-xl leading-relaxed text-slate-400 md:text-2xl">
              Notes from the underground web.
              Arquitetura, sistemas,
              cybersecurity, IA,
              engenharia de software
              e investigações técnicas
              sobre a internet moderna.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-500">
              <span>systems</span>
              <span>•</span>
              <span>research</span>
              <span>•</span>
              <span>underground</span>
              <span>•</span>
              <span>cybersecurity</span>
            </div>
          </div>
        </div>
      </section>

      {/* RECENT POSTS */}
      <section>
        <div className="mb-10 flex items-end justify-between border-b border-white/5 pb-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">
              Latest Research
            </p>

            <h2 className="text-3xl font-bold tracking-[-0.04em]">
              Posts Recentes
            </h2>
          </div>

          <Link
            href="/posts"
            className="group flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-white"
          >
            Ver todos

            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {recentPosts.length > 0 ? (
          <div className="flex flex-col gap-8">
            {recentPosts.map((post) => (
              <PostCard
                key={post.slug}
                post={post}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center backdrop-blur-xl">
            <p className="text-slate-500">
              Nenhum post publicado ainda.
            </p>

            <Link
              href="/keystatic"
              className="mt-3 inline-flex text-sm text-slate-400 transition-colors hover:text-white"
            >
              Criar primeiro post
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}