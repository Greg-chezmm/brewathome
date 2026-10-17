import { calculateABV } from './abv'
import { calculateSRM } from './color'
import { calculateFG, calculateOG } from './gravity'
import { calculateIBU_Rager, calculateIBU_Tinseth } from './ibu'
import type { Fermentable, Hop, IBUFormulaName, RecipeStats, Yeast } from './types'

export interface RecipeStatsInput {
  fermentables: Fermentable[]
  hops: Hop[]
  yeasts: Yeast[]
  targetVolumeL: number
  mashEfficiencyPercent: number
  ibuFormula: IBUFormulaName
}

/** Atténuation par défaut (%) quand la recette n'a pas encore de levure. */
export const DEFAULT_ATTENUATION_PERCENT = 75

/**
 * Estimations d'une recette (OG, FG, IBU, SRM, ABV) — source unique utilisée
 * par le formulaire, l'enregistrement d'une recette et la recette d'un brassin.
 * Garetz demande des volumes d'ébullition absents ici : Tinseth est utilisé en repli.
 */
export function estimateRecipeStats(input: RecipeStatsInput): RecipeStats {
  const { fermentables, hops, yeasts, targetVolumeL, mashEfficiencyPercent, ibuFormula } = input
  const og = calculateOG(fermentables, targetVolumeL, mashEfficiencyPercent)
  const attenuation = yeasts[0]?.attenuationPercent ?? DEFAULT_ATTENUATION_PERCENT
  const fg = calculateFG(og, attenuation)
  const ibu =
    ibuFormula === 'rager'
      ? calculateIBU_Rager(hops, og, targetVolumeL)
      : calculateIBU_Tinseth(hops, og, targetVolumeL)
  const srm = calculateSRM(fermentables, targetVolumeL)
  const abv = calculateABV(og, fg)
  return { og, fg, ibu, srm, abv }
}
