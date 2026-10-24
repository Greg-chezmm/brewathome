import type { BatchStep, BatchStepType } from '@/lib/db/queries/batches'

export const STEP_ICONS: Record<BatchStepType, string> = {
  preparation: '🧽',
  'strike-water': '🔥',
  mash: '🌾',
  'mash-step': '🌡️',
  'mash-out': '🌡️',
  'sparge-water': '🔥',
  sparge: '💧',
  'heat-to-boil': '🔥',
  boil: '🔥',
  'hop-addition': '🌿',
  'other-addition': '➕',
  'chiller-sanitize': '🧼',
  whirlpool: '🌀',
  cooling: '❄️',
  pitch: '🧫',
  cleanup: '🧹',
  'dry-hop-addition': '🧊',
  'fermentation-addition': '🍯',
  'other-fermentation-addition': '🪵',
}

/** Étapes dont le déclenchement se calcule par rapport au compte à rebours d'ébullition. */
export const BOIL_TRIGGERED_STEP_TYPES: BatchStepType[] = ['hop-addition', 'other-addition', 'chiller-sanitize']

/** Regroupement des étapes en 3 phases principales du brassage, chacune avec ses sous-étapes. */
export const STEP_GROUPS: { key: string; label: string; icon: string; types: BatchStepType[] }[] = [
  { key: 'prep', label: 'Préparation', icon: '🧽', types: ['preparation'] },
  { key: 'mash', label: 'Empâtage', icon: '🌾', types: ['strike-water', 'mash', 'mash-step', 'mash-out'] },
  { key: 'lauter', label: 'Filtration et rinçage', icon: '💧', types: ['sparge-water', 'sparge'] },
  { key: 'boil', label: 'Ébullition', icon: '🔥', types: ['heat-to-boil', 'boil', 'hop-addition', 'other-addition', 'chiller-sanitize', 'whirlpool'] },
  { key: 'chill', label: 'Refroidissement', icon: '❄️', types: ['cooling'] },
  { key: 'pitch', label: 'Ensemencement', icon: '🧫', types: ['pitch'] },
  { key: 'cleanup', label: 'Rangement', icon: '🧹', types: ['cleanup'] },
  { key: 'dry-hop', label: 'En fermentation', icon: '🧊', types: ['fermentation-addition', 'dry-hop-addition', 'other-fermentation-addition'] },
]

export interface StepGroup {
  key: string
  label: string
  icon: string
  /** Session des étapes de la phase (brassin en plusieurs sessions), null pour une phase commune. */
  session: number | null
  steps: { step: BatchStep; index: number }[]
}

/**
 * Phases du brassage et leurs étapes. Brassin en plusieurs sessions : une phase par session
 * (« Session 1 · Empâtage »…), rangées dans l'ordre de la journée (session 1, puis session 2).
 */
export function groupSteps(steps: BatchStep[]): StepGroup[] {
  const indexed = steps.map((step, index) => ({ step, index }))
  const sessions = [...new Set(steps.map((s) => s.session ?? null))]
  const groups = STEP_GROUPS.flatMap((g) =>
    sessions.map((session) => ({
      key: session === null ? g.key : `${g.key}-${session}`,
      label: session === null ? g.label : `Session ${session} · ${g.label}`,
      icon: g.icon,
      session,
      steps: indexed.filter(({ step }) => g.types.includes(step.stepType) && (step.session ?? null) === session),
    })),
  ).filter((g) => g.steps.length > 0)
  return sessions.length > 1 ? groups.sort((a, b) => a.steps[0].index - b.steps[0].index) : groups
}

/** Déclenchement d'une étape et état de l'ébullition dont elle dépend. */
export interface BoilTiming {
  timing: AdditionTiming
  boilStarted: boolean
  boilElapsedSeconds: number
}

/** Ébullition dont dépend une étape : celle de sa session. */
export function boilStepFor(steps: BatchStep[], step: BatchStep): BatchStep | undefined {
  return steps.find((s) => s.stepType === 'boil' && (s.session ?? null) === (step.session ?? null))
}

/** Secondes écoulées depuis le début d'une ébullition (0 si pas lancée). */
export function boilElapsedSeconds(boil: BatchStep | undefined, now: number): number {
  return boil?.actualStartAt ? Math.max(0, Math.floor((now - new Date(boil.actualStartAt).getTime()) / 1000)) : 0
}

/** Déclenchement d'une étape d'après l'ébullition de sa session. */
export function boilTiming(steps: BatchStep[], step: BatchStep, now: number): BoilTiming {
  const boil = boilStepFor(steps, step)
  const elapsed = boilElapsedSeconds(boil, now)
  return { timing: additionTiming(step, boil, elapsed), boilStarted: !!boil?.actualStartAt, boilElapsedSeconds: elapsed }
}

export interface AdditionTiming {
  /** Secondes après le début de l'ébullition où l'ajout doit être fait (null si non déclenché par l'ébullition). */
  triggerAtSeconds: number | null
  /** Ajout à faire maintenant (ébullition lancée, moment dépassé, pas encore fait). */
  isDue: boolean
}

export function additionTiming(step: BatchStep, boilStep: BatchStep | undefined, boilElapsedSeconds: number): AdditionTiming {
  if (!BOIL_TRIGGERED_STEP_TYPES.includes(step.stepType) || step.triggerTimeMin === null) {
    return { triggerAtSeconds: null, isDue: false }
  }
  const triggerAtSeconds = ((boilStep?.plannedDurationMin ?? 0) - step.triggerTimeMin) * 60
  const isDue = step.status === 'todo' && !!boilStep?.actualStartAt && boilElapsedSeconds >= triggerAtSeconds
  return { triggerAtSeconds, isDue }
}
