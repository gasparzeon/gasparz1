import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Mail, Shield, EyeOff, BookOpen, Heart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Apoie',
  description:
    'Apoie o Gaspar Labs e ajude a manter pesquisa independente, sem anúncios e sem rastreio.',
}

export default function SupportPage() {
  return (
    <main className="container mx-auto max-w-4xl px-6 py-16 md:py-24">
      <Link
        href="/"
        className="mb-12 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao início
      </Link>

      <section className="mb-20">
        <p className="mb-4 text-xs uppercase tracking-[0.28em] text-slate-500">
          Apoie
        </p>

        <h1 className="mb-8 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white md:text-7xl">
          Sustente pesquisa independente.
        </h1>

        <p className="max-w-2xl text-xl leading-relaxed text-slate-400">
          O Gaspar Labs é um laboratório editorial independente sobre tecnologia,
          internet, cybersecurity, sistemas, cultura digital e pensamento crítico.
          Sem anúncios, sem rastreio, sem ruído. Só análise, pesquisa e arquivo.
        </p>
      </section>

      <section className="mb-16 rounded-2xl border border-white/5 bg-white/[0.025] p-8 backdrop-blur-xl md:p-10">
        <h2 className="mb-4 text-2xl font-bold tracking-[-0.04em]">
          Por que existimos
        </h2>

        <p className="leading-8 text-slate-400">
          A internet moderna vive um paradoxo: boa parte do conteúdo é financiado
          por plataformas, anúncios, rastreadores e incentivos que distorcem a
          atenção. O Gaspar Labs escolhe outro caminho: uma publicação enxuta,
          autoral e independente, sustentada por quem acredita em conhecimento
          livre, análise profunda e uma web menos poluída.
        </p>
      </section>

      <section className="mb-16">
        <h2 className="mb-8 text-2xl font-bold tracking-[-0.04em]">
          O que o seu apoio sustenta
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-6">
            <Shield className="mb-4 h-5 w-5 text-slate-400" />
            <h3 className="mb-2 text-lg font-semibold">Independência editorial</h3>
            <p className="text-sm leading-7 text-slate-500">
              Zero anúncios, zero pressão comercial e liberdade para investigar
              temas sem depender de algoritmos ou patrocinadores invasivos.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-6">
            <EyeOff className="mb-4 h-5 w-5 text-slate-400" />
            <h3 className="mb-2 text-lg font-semibold">Privacidade dos leitores</h3>
            <p className="text-sm leading-7 text-slate-500">
              Sem cookies de rastreio, sem anúncios comportamentais e sem scripts
              de terceiros desnecessários para capturar sua atenção.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-6">
            <BookOpen className="mb-4 h-5 w-5 text-slate-400" />
            <h3 className="mb-2 text-lg font-semibold">Textos longos e profundos</h3>
            <p className="text-sm leading-7 text-slate-500">
              Artigos, investigações, manifestos e análises que não precisam caber
              em formatos curtos, rápidos ou otimizados para clickbait.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-6">
            <Heart className="mb-4 h-5 w-5 text-slate-400" />
            <h3 className="mb-2 text-lg font-semibold">Arquivo vivo da web</h3>
            <p className="text-sm leading-7 text-slate-500">
              Manutenção do blog, domínio, infraestrutura, pesquisa, curadoria e
              continuidade de um espaço independente na internet.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-400/10 bg-slate-400/[0.04] p-8 md:p-10">
        <h2 className="mb-4 text-2xl font-bold tracking-[-0.04em]">
          Como apoiar
        </h2>

        <p className="mb-8 max-w-2xl leading-8 text-slate-400">
          Seja como leitor, parceiro, empresa ou patrono independente, entre em
          contato descrevendo seu interesse. Toda mensagem será respondida
          pessoalmente.
        </p>

        <a
          href="mailto:h4xcats@gmail.com"
          className="inline-flex items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.02]"
        >
          <Mail className="h-4 w-4" />
          h4xcats@gmail.com
        </a>
      </section>
    </main>
  )
}