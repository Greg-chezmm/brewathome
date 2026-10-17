import type { BatchStep } from '@/lib/db/queries/batches'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Début de la fermentation (ms) : fin de l'étape d'ensemencement du Brew Day, à défaut la
 * date de brassage, à défaut le premier relevé. Null si rien ne permet de le dater.
 */
export function fermentationStartTime(
  steps: Pick<BatchStep, 'stepType' | 'actualStartAt' | 'actualEndAt'>[],
  brewDate: string | null,
  firstReadingTime: number | null,
): number | null {
  const pitch = steps.find((s) => s.stepType === 'pitch')
  const pitchedAt = pitch?.actualEndAt ?? pitch?.actualStartAt
  if (pitchedAt) return new Date(pitchedAt).getTime()
  if (brewDate) return new Date(brewDate).getTime()
  return firstReadingTime
}

/** Jours écoulés depuis le début de la fermentation (fractionnaires). */
export function elapsedFermentationDays(start: number, now: number): number {
  return (now - start) / DAY_MS
}

/** Date (ms) d'un jour du profil. */
export function fermentationDayTime(start: number, day: number): number {
  return start + day * DAY_MS
}

/** Écart de température toléré avant de signaler qu'on s'éloigne de la consigne. */
export const TEMPERATURE_TOLERANCE_C = 1.5

/**
 * Température retenue pour le resucrage : la plus haute relevée (le CO₂ dissous dépend de
 * la température la plus chaude atteinte), à défaut celle du profil hors cold crash.
 */
export function primingTemperatureC(
  measuredMaxC: number | null,
  readingTemperatures: (number | null)[],
  profileTemperatures: number[],
): number | null {
  if (measuredMaxC !== null) return measuredMaxC
  const readings = readingTemperatures.filter((t): t is number => t !== null && Number.isFinite(t))
  if (readings.length > 0) return Math.max(...readings)
  const planned = profileTemperatures.filter((t) => Number.isFinite(t))
  return planned.length > 0 ? Math.max(...planned) : null
}
