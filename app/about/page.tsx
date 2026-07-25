import type { Metadata } from 'next'
import Link from 'next/link'
import { Instagram, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sobre',
  description: 'Sobre o Gaspar e o que voce vai encontrar aqui.',
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <article className="prose max-w-none">
        <h1>Sobre</h1>
        
        <p className="text-lg leading-relaxed text-muted-foreground">
          Este e um espaco para pensar em voz alta sobre o craft de construir e entender sistemas. 
          Escrevo sobre arquitetura, ferramentas e as decisoes que tomamos no dia a dia do desenvolvimento, 
          unindo a precisao tecnica a paixao por documentar processos.
        </p>

        <h2>O que voce vai encontrar aqui</h2>
        
        <ul>
          <li>
            <strong>Reflexoes Tecnicas</strong> - Analises sobre decisoes arquiteturais, trade-offs 
            e as licoes aprendidas na pratica de quem vive no terminal.
          </li>
          <li>
            <strong>Tutoriais Praticos</strong> - Guias hands-on sobre ferramentas, automacao 
            e tecnicas que utilizo para resolver problemas e otimizar o trabalho.
          </li>
          <li>
            <strong>Pensamentos Aleatorios</strong> - Textos sobre o que me move fora das telas: 
            a estrategia do UFC, a rotina santista e perspectivas sobre o mundo sob uma otica pessoal.
          </li>
          <li>
            <strong>Opinioes</strong> - Insights sobre a industria, tendencias e o futuro do 
            desenvolvimento de software.
          </li>
        </ul>

        <h2>Contato</h2>
        
        <p>
          Voce pode me encontrar nas redes sociais ou enviar um email:
        </p>

        <div className="not-prose flex flex-wrap gap-3">
          <Link 
            href="https://instagram.com/gasparzeon" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm transition-colors hover:bg-secondary/80"
          >
            <Instagram className="h-4 w-4" />
            Gasparzeon
          </Link>
          <Link 
            href="www.discord.com/users/1360367947385798810" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm transition-colors hover:bg-secondary/80"
          >
            <DiscordIcon className="h-4 w-4" />
            gasparzeon
          </Link>
          <Link 
            href="mailto:h4xcats@gmail.com"
            className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm transition-colors hover:bg-secondary/80"
          >
            <Mail className="h-4 w-4" />
            h4xcats@gmail.com
          </Link>
        </div>
      </article>
    </div>
  )
}
