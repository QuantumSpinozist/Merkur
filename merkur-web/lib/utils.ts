export function truncateTitle(title: string, max: number): string {
  if (title.length <= max) return title
  return title.slice(0, max - 3) + '...'
}
