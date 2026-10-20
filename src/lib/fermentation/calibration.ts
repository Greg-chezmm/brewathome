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

/** Écart minimal (en SG) entre la DI et la DF, et entre départ et fin de l'iSpindel, pour estimer une pente. */
const MIN_TWO_POINT_SPAN = 0.01
/** Une pente hors de cette plage trahit une mesure fausse (DF mal saisie, relevés de fin pas stabilisés) : on l'ignore. */
const SCALE_RANGE = [0.5, 2] as const

export interface GravityCalibration {
  /** DI au densimètre − médiane de départ (même valeur que `gravityOffset`). */
  offset: number
  /** Pente : 1 pour un décalage seul, ≠ 1 quand la DF au densimètre a permis un second point. */
  scale: number
  /** Densité brute autour de laquelle la pente s'applique (médiane de départ). */
  pivot: number
  count: number
  twoPoint: boolean
  manual: boolean
}

/**
 * Calibration de l'iSpindel sur les mesures au densimètre. Un point (DI) donne un décalage ; si la DF est
 * saisie et que les relevés de fin sont disponibles, le second point corrige aussi la pente. Sans second
 * point fiable, ou avec des ajouts de sucre en fermentation (qui changent la chute de densité), décalage seul.
 */
export function gravityCalibration(
  readings: GravityReading[],
  hydrometerOg: number | null,
  hydrometerFg: number | null,
  additionsAddedAt: number | null,
): GravityCalibration | null {
  const start = gravityOffset(readings, hydrometerOg, additionsAddedAt)
  if (!start || hydrometerOg === null) return null
  const base: GravityCalibration = {
    offset: start.offset,
    scale: 1,
    pivot: start.anchorGravity,
    count: start.count,
    twoPoint: false,
    manual: false,
  }
  if (hydrometerFg === null || !Number.isFinite(hydrometerFg) || additionsAddedAt !== null) return base

  const valid = readings
    .filter((r): r is { time: number; gravity: number } => r.gravity !== null && Number.isFinite(r.gravity))
    .sort((a, b) => a.time - b.time)
  const lastTime = valid[valid.length - 1].time
  const end = valid
    .filter((r) => r.time >= lastTime - ANCHOR_WINDOW_MS && r.time > valid[0].time + ANCHOR_WINDOW_MS)
    .map((r) => r.gravity)
    .sort((a, b) => a - b)
  if (end.length < MIN_ANCHOR_READINGS) return base
  const rawDrop = start.anchorGravity - median(end)
  const trueDrop = hydrometerOg - hydrometerFg
  if (rawDrop < MIN_TWO_POINT_SPAN || trueDrop < MIN_TWO_POINT_SPAN) return base
  const scale = trueDrop / rawDrop
  if (scale < SCALE_RANGE[0] || scale > SCALE_RANGE[1]) return base
  return { ...base, scale, twoPoint: true }
}

/** Décalage saisi à la main (en SG), sans pente. */
export function manualCalibration(offset: number): GravityCalibration {
  return { offset, scale: 1, pivot: 1, count: 0, twoPoint: false, manual: true }
}

/** Densité corrigée : `pivot + offset + (brute − pivot) × pente`, arrondie au dixième de point. */
export function applyCalibration(gravity: number | null, calibration: GravityCalibration | null): number | null {
  if (gravity === null) return null
  if (!calibration) return gravity
  const { pivot, offset, scale } = calibration
  return Math.round((pivot + offset + (gravity - pivot) * scale) * 10_000) / 10_000
}
