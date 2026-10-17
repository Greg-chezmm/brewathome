import type { Hop, YeastStyle } from './types'

export type FermentationStepType = 'primary' | 'secondary' | 'conditioning' | 'cold-crash'

/** Une étape du profil de fermentation : une température tenue pendant un nombre de jours. */
export interface FermentationStep {
  type: FermentationStepType
  tempC: number
  days: number
}

export const FERMENTATION_STEP_TYPES: FermentationStepType[] = ['primary', 'secondary', 'conditioning', 'cold-crash']

export const FERMENTATION_STEP_LABELS: Record<FermentationStepType, string> = {
  primary: 'Fermentation primaire',
  secondary: 'Fermentation secondaire',
  conditioning: 'Garde',
  'cold-crash': 'Cold crash',
}

export const FERMENTATION_STEP_TIPS: Record<FermentationStepType, string> = {
  primary: 'La levure consomme les sucres : tenir la température stable, surtout les 3 premiers jours (c’est là que se forment les arômes).',
  secondary: 'Fin de fermentation, souvent 2–3 °C plus chaud : la levure nettoie le diacétyle et termine les derniers sucres.',
  conditioning: 'Maturation : les arômes s’arrondissent et la bière s’éclaircit. Plus long et plus froid pour une lager.',
  'cold-crash': 'Descendre vers 0–4 °C 2 à 3 jours avant l’embouteillage : levure et trouble tombent au fond.',
}

/** Profil proposé d'office selon la levure : ale à 18 °C, lager à 11 °C suivie d'une garde au froid. */
export function defaultFermentationSteps(style: YeastStyle = 'ale'): FermentationStep[] {
  return style === 'lager'
    ? [
        { type: 'primary', tempC: 11, days: 14 },
        { type: 'conditioning', tempC: 2, days: 28 },
      ]
    : [{ type: 'primary', tempC: 18, days: 14 }]
}

/** Étape suivante proposée à l'ajout : cold crash après la fermentation, garde après le cold crash. */
export function nextFermentationStep(steps: FermentationStep[]): FermentationStep {
  const last = steps[steps.length - 1]
  if (!last) return { type: 'primary', tempC: 18, days: 14 }
  if (last.type === 'primary' || last.type === 'secondary') return { type: 'cold-crash', tempC: 2, days: 3 }
  if (last.type === 'cold-crash') return { type: 'conditioning', tempC: 12, days: 14 }
  return { type: 'conditioning', tempC: last.tempC, days: 14 }
}

const validDays = (days: number) => (Number.isFinite(days) && days > 0 ? days : 0)

export function totalFermentationDays(steps: FermentationStep[]): number {
  return steps.reduce((sum, s) => sum + validDays(s.days), 0)
}

export interface ScheduledFermentationStep extends FermentationStep {
  /** Jour de début, compté depuis l'ensemencement (jour 0). */
  startDay: number
  endDay: number
}

export function fermentationSchedule(steps: FermentationStep[]): ScheduledFermentationStep[] {
  let day = 0
  return steps.map((s) => {
    const startDay = day
    day += validDays(s.days)
    return { ...s, startDay, endDay: day }
  })
}

export interface FermentationPosition {
  /** Étape en cours (null une fois le profil terminé). */
  current: ScheduledFermentationStep | null
  index: number
  /** Jours restants dans l'étape en cours. */
  daysLeftInStep: number
  next: ScheduledFermentationStep | null
  done: boolean
}

/** Où en est le brassin dans son profil, `elapsedDays` jours après l'ensemencement. */
export function fermentationPositionAt(steps: FermentationStep[], elapsedDays: number): FermentationPosition | null {
  const schedule = fermentationSchedule(steps).filter((s) => s.endDay > s.startDay)
  if (schedule.length === 0) return null
  const index = schedule.findIndex((s) => elapsedDays < s.endDay)
  if (index === -1) return { current: null, index: schedule.length, daysLeftInStep: 0, next: null, done: true }
  const current = schedule[index]
  return {
    current,
    index,
    daysLeftInStep: Math.max(0, current.endDay - Math.max(0, elapsedDays)),
    next: schedule[index + 1] ?? null,
    done: false,
  }
}

export interface DryHopEvent {
  name: string
  amountG: number
  /** Jour d'ajout depuis l'ensemencement. */
  day: number
  /** Jour de retrait (ajout + temps de contact), null si la durée n'est pas connue. */
  removeDay: number | null
}

/**
 * Calendrier des dry hops. Sans jour renseigné, le houblon est ajouté pour finir avec
 * la fermentation primaire (fin de primaire − durée de contact), au plus tôt au jour 3.
 */
export function dryHopEvents(hops: Hop[], steps: FermentationStep[]): DryHopEvent[] {
  const primary = fermentationSchedule(steps).find((s) => s.type === 'primary')
  return hops
    .filter((h) => h.use === 'dry-hop')
    .map((h) => {
      const contact = h.dryHopDays !== undefined && Number.isFinite(h.dryHopDays) ? h.dryHopDays : null
      const day =
        h.dryHopDay !== undefined && Number.isFinite(h.dryHopDay)
          ? h.dryHopDay
          : Math.max(3, (primary?.endDay ?? 14) - (contact ?? 4))
      return { name: h.name, amountG: h.amountG, day, removeDay: contact !== null ? day + contact : null }
    })
    .sort((a, b) => a.day - b.day)
}
