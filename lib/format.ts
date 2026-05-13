import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(dateString: string): string {
  const date = parseISO(dateString)
  return format(date, "d 'de' MMMM, yyyy", { locale: ptBR })
}

export function formatDateShort(dateString: string): string {
  const date = parseISO(dateString)
  return format(date, "d MMM yyyy", { locale: ptBR })
}
