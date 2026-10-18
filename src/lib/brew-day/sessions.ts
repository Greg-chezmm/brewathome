import { fermentableUse } from '@/lib/brew-calc/gravity'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { calculateVolumes, type VolumeBreakdown } from '@/lib/brew-calc/volumes'
import type { RecipeDetails } from '@/lib/db/queries/recipes'
import type { MeasurementKey, MeasurementValues } from './measurements'

/**
 * Brassin en plusieurs sessions : la cuve est trop petite pour toute la recette, on la brasse
 * en deux fois le même jour (chaque session = une part de la recette côté chaud : empâtage,
 * ébullition, refroidissement), et les deux moûts finissent dans le même fermenteur.
 */
export const MAX_BREW_SESSIONS = 2

/** Mesures relevées à chaque session ; `fermenterVolumeL` est ici le volume versé au fermenteur par la session. */
export const SESSION_MEASUREMENT_KEYS = [
  'preBoilVolumeL',
  'preBoilGravity',
  'postBoilVolumeL',
  'postBoilGravity',
  'fermenterVolumeL',
] as const satisfies readonly MeasurementKey[]

export type SessionMeasurementKey = (typeof SESSION_MEASUREMENT_KEYS)[number]
export type SessionMeasurements = Record<SessionMeasurementKey, number | null>

/** Libellés propres aux sessions (le reste reprend ceux du brassin). */
export const SESSION_MEASUREMENT_LABELS: Partial<Record<MeasurementKey, string>> = {
  fermenterVolumeL: 'Volume versé au fermenteur',
}

const EMPTY_SESSION: SessionMeasurements = {
  preBoilVolumeL: null,
  preBoilGravity: null,
  postBoilVolumeL: null,
  postBoilGravity: null,
  fermenterVolumeL: null,
}

export function clampBrewSessions(value: unknown): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(MAX_BREW_SESSIONS, Math.max(1, n)) : 1
}

/**
 * Part de la recette brassée à chaque session : grain, sucres d'ébullition, houblons d'ébullition,
 * de premier moût et de whirlpool divisés, pour une part du volume. La levure, les ajouts en
 * fermentation et le houblonnage à froid vont une seule fois dans le fermenteur : inchangés.
 * Les ajouts divers (quantité en texte libre) sont annotés « ÷ 2 ».
 */
export function sessionRecipe(recipe: RecipeDetails, sessions: number): RecipeDetails {
  if (sessions <= 1) return recipe
  return {
    ...recipe,
    targetVolumeL: recipe.targetVolumeL / sessions,
    fermentables: recipe.fermentables.map((f) =>
      fermentableUse(f) === 'fermentation' ? f : { ...f, amountKg: f.amountKg / sessions },
    ),
    hops: recipe.hops.map((h) => (h.use === 'dry-hop' ? h : { ...h, amountG: h.amountG / sessions })),
    otherIngredients: recipe.otherIngredients.map((o) => ({ ...o, amount: `${o.amount} ÷ ${sessions}` })),
  }
}

/** Volumes d'une session (part de la recette), ou null sans profil d'équipement. */
export function sessionVolumes(
  recipe: RecipeDetails,
  sessions: number,
  equipment: EquipmentProfile | null | undefined,
): VolumeBreakdown | null {
  if (!equipment) return null
  const part = sessionRecipe(recipe, sessions)
  const grainKg = part.fermentables
    .filter((f) => f.type === 'grain' && fermentableUse(f) === 'mash')
    .reduce((sum, f) => sum + f.amountKg, 0)
  return calculateVolumes(part.targetVolumeL, grainKg, part.boilTimeMin, equipment)
}

/** Volumes de toute la journée : ceux d'une session multipliés par le nombre de sessions. */
export function scaleVolumes(volumes: VolumeBreakdown, factor: number): VolumeBreakdown {
  return Object.fromEntries(Object.entries(volumes).map(([key, value]) => [key, value * factor])) as unknown as VolumeBreakdown
}

/** La recette déborde de la cuve d'ébullition : la brasser en 2 sessions. */
export function exceedsKettle(recipe: RecipeDetails, equipment: EquipmentProfile | null | undefined): boolean {
  const volumes = sessionVolumes(recipe, 1, equipment)
  return !!equipment && !!volumes && volumes.preBoilVolumeL > equipment.boilKettleVolumeL + 0.05
}

/** Mesures enregistrées (jsonb) → une entrée par session, champs manquants à null. */
export function normalizeSessionMeasurements(raw: unknown, sessions: number): SessionMeasurements[] {
  const list = Array.isArray(raw) ? raw : []
  return Array.from({ length: sessions }, (_, i) => {
    const entry = (list[i] ?? {}) as Record<string, unknown>
    return Object.fromEntries(
      SESSION_MEASUREMENT_KEYS.map((key) => {
        const value = entry[key]
        return [key, value === null || value === undefined || value === '' ? null : Number(value)]
      }),
    ) as SessionMeasurements
  })
}

export function emptySessionMeasurements(): SessionMeasurements {
  return { ...EMPTY_SESSION }
}

/** Volume total, ou null tant qu'une session manque. */
function sumVolumes(volumes: (number | null)[]): number | null {
  return volumes.every((v): v is number => v !== null) ? volumes.reduce((a, b) => a + b, 0) : null
}

/** Densité du mélange : moyenne des points de densité pondérée par les volumes (null tant qu'il manque une valeur). */
export function blendGravity(parts: { gravity: number | null; volumeL: number | null }[], extraWaterL = 0): number | null {
  if (parts.length === 0 || parts.some((p) => p.gravity === null || p.volumeL === null)) return null
  const volume = parts.reduce((sum, p) => sum + p.volumeL!, 0) + extraWaterL
  if (volume <= 0) return null
  const points = parts.reduce((sum, p) => sum + (p.gravity! - 1) * p.volumeL!, 0)
  return 1 + points / volume
}

/**
 * Mesures du brassin entier tirées des sessions : volumes additionnés, densités moyennées selon
 * les volumes. Les efficacités et l'historique se calculent ensuite comme pour un brassin d'une session.
 */
export function aggregateSessionMeasurements(
  sessions: SessionMeasurements[],
): Pick<MeasurementValues, 'preBoilVolumeL' | 'preBoilGravity' | 'postBoilVolumeL' | 'postBoilGravity'> {
  return {
    preBoilVolumeL: sumVolumes(sessions.map((s) => s.preBoilVolumeL)),
    preBoilGravity: blendGravity(sessions.map((s) => ({ gravity: s.preBoilGravity, volumeL: s.preBoilVolumeL }))),
    postBoilVolumeL: sumVolumes(sessions.map((s) => s.postBoilVolumeL)),
    postBoilGravity: blendGravity(sessions.map((s) => ({ gravity: s.postBoilGravity, volumeL: s.postBoilVolumeL }))),
  }
}

/**
 * Fermenteur rempli par les sessions : volume (versements + eau d'appoint) et DI du mélange,
 * moyenne des densités de fin d'ébullition pondérée par les volumes versés.
 */
export function blendedFermenter(
  sessions: SessionMeasurements[],
  topUpL: number | null,
): { og: number; volumeL: number } | null {
  const transferred = sumVolumes(sessions.map((s) => s.fermenterVolumeL))
  const og = blendGravity(
    sessions.map((s) => ({ gravity: s.postBoilGravity, volumeL: s.fermenterVolumeL })),
    topUpL ?? 0,
  )
  return og !== null && transferred !== null ? { og, volumeL: transferred + (topUpL ?? 0) } : null
}
