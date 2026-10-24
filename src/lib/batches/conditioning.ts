/** Refermentation en bouteille : 2 à 3 semaines à température de cave ou de pièce. */
export const DEFAULT_CONDITIONING_DAYS = 21

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Jours depuis 1970 d'un « AAAA-MM-JJ », calculés en UTC : aucun décalage au changement d'heure. */
function dayNumber(iso: string): number | null {
  const m = ISO_DAY.exec(iso)
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(ms) ? null : Math.round(ms / 86_400_000)
}

function isoFromDayNumber(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10)
}

/** Date à partir de laquelle la bière est prête à boire (AAAA-MM-JJ) ; null sans date d'embouteillage valide. */
export function readyDate(bottledAt: string | null | undefined, days: number = DEFAULT_CONDITIONING_DAYS): string | null {
  const start = bottledAt ? dayNumber(bottledAt) : null
  if (start === null) return null
  const duration = Number.isFinite(days) && days > 0 ? Math.round(days) : DEFAULT_CONDITIONING_DAYS
  return isoFromDayNumber(start + duration)
}

/** Jours entre `todayIso` et `readyIso` : positif avant la date, 0 le jour même, négatif après. */
export function daysUntilReady(readyIso: string, todayIso: string): number {
  const ready = dayNumber(readyIso)
  const today = dayNumber(todayIso)
  return ready === null || today === null ? Number.NaN : ready - today
}

const frenchDate = (iso: string) => iso.split('-').reverse().join('/')

/** « Prête à boire dans 5 jours (14/11/2026) » ; null sans date d'embouteillage. */
export function readyLabel(
  bottledAt: string | null | undefined,
  days: number = DEFAULT_CONDITIONING_DAYS,
  todayIso: string,
): string | null {
  const ready = readyDate(bottledAt, days)
  if (!ready) return null
  const left = daysUntilReady(ready, todayIso)
  const date = frenchDate(ready)
  if (left === 0) return `Prête à boire aujourd’hui (${date})`
  if (left === 1) return `Prête à boire demain (${date})`
  if (left > 1) return `Prête à boire dans ${left} jours (${date})`
  const ago = -left
  return `Prête à boire depuis ${ago} jour${ago > 1 ? 's' : ''} (${date})`
}
