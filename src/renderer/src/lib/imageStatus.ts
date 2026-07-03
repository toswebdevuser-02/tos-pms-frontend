import { Attachment } from '../types'

export const IMP_WEIGHT: Record<string, number> = { High: 3, Medium: 2, Low: 1 }

export function weight(importance?: string): number {
  return IMP_WEIGHT[importance ?? 'Medium'] ?? 2
}

export function isAnswered(a: Attachment): boolean {
  return !!String(a.response ?? '').trim()
}

export interface ImageStats {
  total: number
  responded: number
  pct: number | null // null when there are no images
}

export function statsFor(atts: Attachment[]): ImageStats {
  const total = atts.length
  const responded = atts.filter(isAnswered).length
  const totalW = atts.reduce((s, a) => s + weight(a.importance), 0)
  const respW = atts.reduce((s, a) => s + (isAnswered(a) ? weight(a.importance) : 0), 0)
  const pct = totalW ? Math.round((respW / totalW) * 100) : null
  return { total, responded, pct }
}

export function level(pct: number | null): 'green' | 'yellow' | 'red' | 'none' {
  if (pct === null) return 'none'
  if (pct >= 100) return 'green'
  if (pct <= 0) return 'red'
  return 'yellow'
}
