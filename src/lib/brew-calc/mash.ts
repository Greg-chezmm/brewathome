import { REFERENCE_MASH_TEMP_C } from './recipe-stats'

/** Un palier d'empâtage : on monte la maische à `tempC` et on l'y maintient `timeMin` minutes. */
export interface MashStep {
  name: string
  tempC: number
  timeMin: number
}

/** À partir de cette température, un dernier palier est un mash-out (les enzymes sont bloquées). */
export const MASH_OUT_MIN_TEMP_C = 75

/** Mash-out par défaut : bloque les enzymes et fluidifie le moût avant filtration. */
export const MASH_OUT_TEMP_C = 76
const MASH_OUT_TIME_MIN = 10

/** Durée du palier principal quand la recette n'en précise pas. */
const DEFAULT_MAIN_STEP_MIN = 60

/**
 * Empâtage d'une recette qui n'a pas de paliers enregistrés (recettes et brassins antérieurs) :
 * le palier principal à sa température, 60 min, puis un mash-out — c'était le déroulé implicite.
 */
export function defaultMashSteps(mainTempC: number = REFERENCE_MASH_TEMP_C): MashStep[] {
  return [
    { name: 'Saccharification', tempC: mainTempC, timeMin: DEFAULT_MAIN_STEP_MIN },
    { name: 'Mash-out', tempC: MASH_OUT_TEMP_C, timeMin: MASH_OUT_TIME_MIN },
  ]
}

/** Paliers de la recette, ou le déroulé par défaut si elle n'en a pas. */
export function effectiveMashSteps(recipe: { mashSteps?: MashStep[] | null; mashTempC?: number | null }): MashStep[] {
  return recipe.mashSteps && recipe.mashSteps.length > 0
    ? recipe.mashSteps
    : defaultMashSteps(recipe.mashTempC ?? REFERENCE_MASH_TEMP_C)
}

/** Le dernier palier, s'il est assez chaud, est le mash-out. */
export function isMashOut(steps: MashStep[], index: number): boolean {
  return index > 0 && index === steps.length - 1 && steps[index].tempC >= MASH_OUT_MIN_TEMP_C
}

/**
 * Palier principal : le plus long hors mash-out (la saccharification). C'est sa température
 * qui ajuste l'atténuation estimée. Null si la recette n'a aucun palier.
 */
export function mainMashStep(steps: MashStep[]): MashStep | null {
  const candidates = steps.filter((_, i) => !isMashOut(steps, i))
  const pool = candidates.length > 0 ? candidates : steps
  return pool.reduce<MashStep | null>((best, step) => (best === null || step.timeMin > best.timeMin ? step : best), null)
}

/** Température d'empâtage retenue pour le calcul : celle du palier principal. */
export function mainMashTempC(steps: MashStep[], fallback: number = REFERENCE_MASH_TEMP_C): number {
  const main = mainMashStep(steps)
  return main && Number.isFinite(main.tempC) ? main.tempC : fallback
}

export function totalMashTimeMin(steps: MashStep[]): number {
  return steps.reduce((sum, s) => sum + (Number.isFinite(s.timeMin) ? s.timeMin : 0), 0)
}

export type MashStepRole = 'acid' | 'protein' | 'beta' | 'balanced' | 'alpha' | 'mash-out'

/** Ce qui se passe dans la maische selon la température du palier. */
export function mashStepRole(tempC: number): MashStepRole {
  if (tempC >= MASH_OUT_MIN_TEMP_C) return 'mash-out'
  if (tempC >= 68) return 'alpha'
  if (tempC >= 66) return 'balanced'
  if (tempC >= 60) return 'beta'
  if (tempC >= 45) return 'protein'
  return 'acid'
}

export const MASH_STEP_ROLE_LABELS: Record<MashStepRole, string> = {
  acid: 'Repos acide / glucanes',
  protein: 'Repos protéinique',
  beta: 'Bêta-amylase : bière sèche',
  balanced: 'Saccharification équilibrée',
  alpha: 'Alpha-amylase : bière ronde',
  'mash-out': 'Mash-out : enzymes bloquées',
}

/** Explication d'un palier, affichée dans le formulaire et au Brew Day. */
export function mashStepTip(tempC: number): string {
  switch (mashStepRole(tempC)) {
    case 'acid':
      return `À ${tempC} °C, les glucanases dégradent les gommes (seigle, avoine, blé cru) : filtration plus facile. Utile surtout avec beaucoup de céréales non maltées.`
    case 'protein':
      return `À ${tempC} °C, les protéases cassent les protéines : moins de trouble, mais une mousse plus fragile si le palier dure trop. Rarement utile avec les malts modernes, sauf beaucoup de blé ou d'avoine.`
    case 'beta':
      return `À ${tempC} °C, l'enzyme bêta-amylase domine : moût très fermentescible, bière sèche et plus alcoolisée.`
    case 'balanced':
      return `À ${tempC} °C, les deux enzymes travaillent : bon équilibre entre corps et fermentescibilité.`
    case 'alpha':
      return `À ${tempC} °C, l'enzyme alpha-amylase domine : plus de sucres non fermentescibles, bière plus ronde et en corps, un peu moins d'alcool.`
    case 'mash-out':
      return 'Le mash-out bloque les enzymes (le profil de sucres est figé) et fluidifie le moût : la filtration est plus facile.'
  }
}

/** Paliers courants, proposés à la saisie du nom : ils reprennent leur température et leur durée typiques. */
export const MASH_STEP_LIBRARY: MashStep[] = [
  { name: 'Repos protéinique', tempC: 52, timeMin: 15 },
  { name: 'Bêta-amylase', tempC: 63, timeMin: 30 },
  { name: 'Saccharification', tempC: 67, timeMin: 60 },
  { name: 'Alpha-amylase', tempC: 72, timeMin: 20 },
  { name: 'Mash-out', tempC: MASH_OUT_TEMP_C, timeMin: MASH_OUT_TIME_MIN },
]
