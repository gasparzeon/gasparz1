import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="container mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-32 text-center">
      <h1 className="mb-4 text-6xl font-bold">404</h1>
      <p className="mb-8 text-xl text-muted-foreground">
        Pagina nao encontrada
      </p>
      <p className="mb-8 max-w-md text-muted-foreground">
        A pagina que voce esta procurando nao existe ou foi movida para outro endereco.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm text-background transition-colors hover:bg-foreground/90"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para o inicio
      </Link>
    </div>
  )
}
