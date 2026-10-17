import { calculateABV_simple } from '@/lib/brew-calc/abv'

export interface GravityReading {
  time: number
  gravity: number | null
}

/** Relevés lissés pour la densité « actuelle » : un iSpindel bruite d'environ ±0,001 d'un envoi à l'autre. */
const RECENT_READINGS = 4

/** Densité actuelle : médiane des derniers relevés de densité (null s'il n'y en a pas). */
export function currentGravity(readings: GravityReading[]): number | null {
  const recent = readings
    .filter((r): r is { time: number; gravity: number } => r.gravity !== null && Number.isFinite(r.gravity))
    .sort((a, b) => a.time - b.time)
    .slice(-RECENT_READINGS)
    .map((r) => r.gravity)
    .sort((a, b) => a - b)
  if (recent.length === 0) return null
  const mid = Math.floor(recent.length / 2)
  return recent.length % 2 ? recent[mid] : (recent[mid - 1] + recent[mid]) / 2
}

export interface FermentationProgress {
  /** Alcool déjà produit (% vol.), d'après la baisse de densité depuis la DI. */
  abv: number
  /** Atténuation apparente atteinte (%). */
  attenuation: number
  /** Chemin parcouru de la DI vers la DF prévue (%) ; peut dépasser 100 si la bière finit plus sèche. */
  progressPercent: number | null
}

/** Où en est la fermentation : alcool et atténuation à la densité donnée. */
export function fermentationProgress(og: number, gravity: number, plannedFg: number | null): FermentationProgress {
  const drop = Math.max(0, og - gravity)
  return {
    abv: calculateABV_simple(og, og - drop),
    attenuation: og > 1 ? (drop / (og - 1)) * 100 : 0,
    progressPercent: plannedFg !== null && og > plannedFg ? (drop / (og - plannedFg)) * 100 : null,
  }
}
