import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getAllPosts } from '@/lib/content'
import { PostCard } from '@/components/post-card'

export default async function HomePage() {
  const posts = await getAllPosts()
  const recentPosts = posts.slice(0, 3)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
      {/* Hero Section */}
      <section className="mb-20">
        <h1 className="mb-6 text-balance">
          Gaspar - <span className="text-accent">2026</span>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
          Um espaco para pensar em voz alta sobre o craft de construir e entender sistemas. 
          Arquitetura, ferramentas e as decisoes que tomamos no dia a dia do desenvolvimento.
        </p>
      </section>

      {/* Recent Posts */}
      <section>
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Posts Recentes</h2>
          <Link 
            href="/posts" 
            className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver todos
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {recentPosts.length > 0 ? (
          <div className="flex flex-col gap-6">
            {recentPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              Nenhum post publicado ainda. 
              <Link href="/keystatic" className="ml-1 text-accent hover:underline">
                Crie seu primeiro post
              </Link>
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
