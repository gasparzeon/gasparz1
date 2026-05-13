export function formatDate(date: string | Date | null | undefined) {
  if (!date) return ''

  const parsedDate =
    date instanceof Date
      ? date
      : new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsedDate)
}