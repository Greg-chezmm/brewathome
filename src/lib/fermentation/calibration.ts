import type { GravityReading } from './progress'

const HOUR_MS = 3_600_000

/** Les relevés du début de fermentation (avant que la densité ne bouge) servent d'ancre au décalage. */
const ANCHOR_WINDOW_MS = 6 * HOUR_MS
/** En deçà, un relevé isolé ou aberrant ferait la loi : on ne corrige pas. */
const MIN_ANCHOR_READINGS = 3

export interface GravityOffset {
  /** À ajouter aux densités de l'iSpindel : DI au densimètre − médiane des premiers relevés. */
  offset: number
  /** Médiane brute des relevés de départ. */
  anchorGravity: number
  /** Nombre de relevés retenus. */
  count: number
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Décalage de l'iSpindel par rapport au densimètre. La DI saisie au densimètre est la référence :
 * sans elle, rien n'est corrigé. L'ancre est la médiane des relevés des premières heures, avant les
 * ajouts en fermentation (`additionsAddedAt`), plutôt que le tout premier relevé, trop bruité.
 */
export function gravityOffset(
  readings: GravityReading[],
  hydrometerOg: number | null,
  additionsAddedAt: number | null,
): GravityOffset | null {
  if (hydrometerOg === null || !Number.isFinite(hydrometerOg)) return null
  const valid = readings
    .filter((r): r is { time: number; gravity: number } => r.gravity !== null && Number.isFinite(r.gravity))
    .sort((a, b) => a.time - b.time)
  if (valid.length === 0) return null
  const windowEnd = valid[0].time + ANCHOR_WINDOW_MS
  const anchor = valid
    .filter((r) => r.time <= windowEnd && (additionsAddedAt === null || r.time < additionsAddedAt))
    .map((r) => r.gravity)
    .sort((a, b) => a - b)
  if (anchor.length < MIN_ANCHOR_READINGS) return null
  const anchorGravity = median(anchor)
  return { offset: hydrometerOg - anchorGravity, anchorGravity, count: anchor.length }
}

/** Densité corrigée du décalage (arrondie au dixième de point : l'iSpindel n'est pas plus précis). */
export function applyGravityOffset(gravity: number | null, offset: number): number | null {
  if (gravity === null) return null
  return Math.round((gravity + offset) * 10_000) / 10_000
}
