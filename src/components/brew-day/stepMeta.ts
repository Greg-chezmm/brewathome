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
  { key: 'dry-hop', label: 'Houblonnage à froid', icon: '🧊', types: ['dry-hop-addition'] },
]

export interface StepGroup {
  key: string
  label: string
  icon: string
  steps: { step: BatchStep; index: number }[]
}

export function groupSteps(steps: BatchStep[]): StepGroup[] {
  return STEP_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    icon: g.icon,
    steps: steps.map((step, index) => ({ step, index })).filter(({ step }) => g.types.includes(step.stepType)),
  })).filter((g) => g.steps.length > 0)
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
