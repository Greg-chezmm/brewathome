import { calculateABV_simple } from '@/lib/brew-calc/abv'
import type { BatchStep } from '@/lib/db/queries/batches'

/**
 * Instant (ms) où les ajouts en fermentation (sucre, miel…) sont dans le fermenteur : une fois toutes
 * les étapes « Ajout en fermentation » faites, la plus tardive de leurs dates de fin (-Infinity si
 * aucune n'est datée : on les compte alors depuis le début). null s'il n'y en a pas ou qu'il en reste
 * à faire : la densité relevée ne les contient pas encore, l'alcool se calcule sur la DI seule.
 */
export function fermentationAdditionsAddedAt(steps: Pick<BatchStep, 'stepType' | 'status' | 'actualEndAt'>[]): number | null {
  const additions = steps.filter((s) => s.stepType === 'fermentation-addition')
  if (additions.length === 0 || additions.some((s) => s.status !== 'done')) return null
  return Math.max(...additions.map((s) => (s.actualEndAt ? new Date(s.actualEndAt).getTime() : -Infinity)))
}

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
