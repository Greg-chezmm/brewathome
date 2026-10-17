export interface GravityPoint {
  time: number
  gravity: number | null
}

export interface GravityStability {
  /** Densité lissée la plus récente. */
  gravity: number
  /** Début de la période où la densité ne bouge plus (à la tolérance près). */
  stableSince: number
  /** Durée de cette période, en jours. */
  stableDays: number
  /** Assez longue pour suggérer la fin de fermentation. */
  stable: boolean
}

/** Les relevés sont regroupés par tranches de 6 h et lissés par leur médiane : un iSpindel bruite d'environ ±0,001. */
const BUCKET_MS = 6 * 3600_000
/** Écart toléré autour de la densité actuelle pour la considérer comme inchangée. */
export const STABLE_TOLERANCE = 0.001
/** Durée au bout de laquelle une densité immobile signale une fermentation probablement terminée. */
export const STABLE_DAYS = 2
/** En dessous de cette baisse depuis le maximum, la fermentation n'a pas vraiment démarré. */
const MIN_DROP = 0.005

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Depuis combien de temps la densité ne baisse plus. `null` tant qu'il n'y a pas de quoi juger
 * (moins de deux tranches de relevés, ou fermentation pas encore partie).
 */
export function gravityStability(points: GravityPoint[]): GravityStability | null {
  const known = points
    .filter((p): p is { time: number; gravity: number } => p.gravity !== null && Number.isFinite(p.gravity))
    .sort((a, b) => a.time - b.time)
  if (known.length < 2) return null

  const buckets: { start: number; end: number; gravity: number }[] = []
  let current: typeof known = []
  for (const point of known) {
    if (current.length > 0 && Math.floor(point.time / BUCKET_MS) !== Math.floor(current[0].time / BUCKET_MS)) {
      buckets.push({ start: current[0].time, end: current[current.length - 1].time, gravity: median(current.map((p) => p.gravity)) })
      current = []
    }
    current.push(point)
  }
  buckets.push({ start: current[0].time, end: current[current.length - 1].time, gravity: median(current.map((p) => p.gravity)) })
  if (buckets.length < 2) return null

  const latest = buckets[buckets.length - 1]
  const highest = Math.max(...buckets.map((b) => b.gravity))
  if (highest - latest.gravity < MIN_DROP) return null

  // Tolérance un rien élargie : 1.017 - 1.016 doit compter comme « inchangé » malgré l'arrondi flottant.
  let since = latest.start
  for (let i = buckets.length - 2; i >= 0; i--) {
    if (Math.abs(buckets[i].gravity - latest.gravity) > STABLE_TOLERANCE + 1e-9) break
    since = buckets[i].start
  }
  const stableDays = (latest.end - since) / 86_400_000
  return { gravity: latest.gravity, stableSince: since, stableDays, stable: stableDays >= STABLE_DAYS }
}
