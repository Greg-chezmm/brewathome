/** Une dégustation d'un brassin (on peut en faire plusieurs : à deux semaines, à deux mois…). */
export interface Tasting {
  id: string
  /** Jour de la dégustation, AAAA-MM-JJ. */
  date: string
  /** Note de 1 à 5 ; null tant qu'elle n'est pas donnée. */
  rating: number | null
  appearance: string
  aroma: string
  taste: string
  /** « À changer la prochaine fois ». */
  changeNext: string
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded >= 1 && rounded <= 5 ? rounded : null
}

/** Valeur lue en base (jsonb libre) → dégustations valides, de la plus récente à la plus ancienne. */
export function normalizeTastings(raw: unknown): Tasting[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((entry): Tasting[] => {
      if (!entry || typeof entry !== 'object') return []
      const e = entry as Record<string, unknown>
      if (typeof e.id !== 'string' || e.id === '' || typeof e.date !== 'string' || !ISO_DAY.test(e.date)) return []
      return [
        {
          id: e.id,
          date: e.date,
          rating: normalizeRating(e.rating),
          appearance: text(e.appearance),
          aroma: text(e.aroma),
          taste: text(e.taste),
          changeNext: text(e.changeNext),
        },
      ]
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function newTasting(date: string, id: string): Tasting {
  return { id, date, rating: null, appearance: '', aroma: '', taste: '', changeNext: '' }
}

/** Moyenne des notes données, à une décimale ; null sans aucune note. */
export function averageRating(tastings: Tasting[]): number | null {
  const ratings = tastings.map((t) => t.rating).filter((r): r is number => r !== null)
  if (ratings.length === 0) return null
  return Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
}
