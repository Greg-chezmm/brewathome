import { mainMashTempC } from '@/lib/brew-calc/mash'
import { adjustAttenuationForMashTemp, mashTempAttenuationOffset } from '@/lib/brew-calc/recipe-stats'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { apparentAttenuation, effectiveOg, mashEfficiencyPercent } from '@/lib/brew-day/measurements'
import type { BatchDetails } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

/** Ce qu'un brassin a réellement donné, prêt à être reporté sur la recette et l'équipement. */
export interface MeasuredResults {
  /** Efficacité d'empâtage prévue par la recette du brassin et mesurée (null sans densité et volume pré-ébullition). */
  plannedMashEfficiency: number
  mashEfficiency: number | null
  /** Levure principale du brassin (la seule qui compte dans le calcul de la DF). */
  yeastName: string | null
  /** Atténuation annoncée sur la levure et atténuation qu'il faudrait y mettre pour retomber sur la DF mesurée. */
  plannedYeastAttenuation: number | null
  yeastAttenuation: number | null
  /** Atténuation apparente prévue (levure ajustée par l'empâtage) et mesurée, en %. */
  plannedAttenuation: number | null
  attenuation: number | null
  /** Température d'empâtage du brassin, qui a joué sur l'atténuation. */
  mashTempC: number
}

/** Arrondi au demi-point : la précision des mesures ne justifie pas mieux. */
const roundHalf = (value: number) => Math.round(value * 2) / 2

/**
 * Résultats mesurés d'un brassin. L'atténuation réelle dépend aussi de l'empâtage : pour que le
 * calcul de la recette (`computeRecipe`, qui retire 1 point par °C au-dessus de 67 °C) retombe sur
 * la DF mesurée, la levure doit recevoir l'atténuation mesurée **plus** ce retrait.
 */
export function measuredResults(batch: BatchDetails, equipment: EquipmentProfile | null | undefined): MeasuredResults {
  const recipe = batch.recipeSnapshot
  const m = batch.measurements
  const og = m.og ?? batch.ogMeasured
  const fg = m.fg ?? batch.fgMeasured
  const fermenterVolumeL = m.fermenterVolumeL ?? batch.volumeMeasuredL
  const mashTempC = mainMashTempC(recipe.mashSteps, recipe.mashTempC)
  const yeast = recipe.yeasts[0] ?? null

  const efficiency =
    m.preBoilGravity !== null && m.preBoilVolumeL !== null
      ? mashEfficiencyPercent(recipe, m.preBoilGravity, m.preBoilVolumeL, equipment?.thermalShrinkagePercent)
      : null
  const attenuation = og !== null && fg !== null && og > 1 ? apparentAttenuation(effectiveOg(recipe, og, fermenterVolumeL), fg) : null

  return {
    plannedMashEfficiency: recipe.mashEfficiencyPercent,
    mashEfficiency: efficiency !== null && efficiency > 0 ? roundHalf(efficiency) : null,
    yeastName: yeast?.name ?? null,
    plannedYeastAttenuation: yeast?.attenuationPercent ?? null,
    yeastAttenuation: yeast && attenuation !== null ? roundHalf(attenuation + mashTempAttenuationOffset(mashTempC)) : null,
    plannedAttenuation: yeast ? adjustAttenuationForMashTemp(yeast.attenuationPercent, mashTempC) : null,
    attenuation: attenuation !== null ? roundHalf(attenuation) : null,
    mashTempC,
  }
}

/** Valeurs à reporter sur une recette ; chaque champ absent laisse la valeur en place. */
export interface ResultsToApply {
  mashEfficiencyPercent?: number
  /** Atténuation de la levure principale, si c'est bien la même levure (même nom). */
  yeastAttenuationPercent?: number
  yeastName?: string | null
}

/**
 * Recette avec les résultats reportés : efficacité d'empâtage, et atténuation de la levure
 * principale seulement si c'est la même levure que celle du brassin (la recette a pu changer depuis).
 */
export function withAppliedResults<R extends Pick<RecipeDetails, 'mashEfficiencyPercent' | 'yeasts'>>(
  recipe: R,
  results: ResultsToApply,
): R {
  const [first, ...others] = recipe.yeasts
  const sameYeast = first !== undefined && results.yeastAttenuationPercent !== undefined && first.name === results.yeastName
  return {
    ...recipe,
    mashEfficiencyPercent: results.mashEfficiencyPercent ?? recipe.mashEfficiencyPercent,
    yeasts: sameYeast ? [{ ...first, attenuationPercent: results.yeastAttenuationPercent! }, ...others] : recipe.yeasts,
  }
}
