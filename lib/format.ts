export function formatDate(date: string | Date | null | undefined) {
  if (!date) return '';

  const parsedDate = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  // Datas do frontmatter (AAAA-MM-DD) são interpretadas como meia-noite
  // UTC; formatar em UTC evita mostrar o dia anterior em fusos negativos.
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsedDate);
}
