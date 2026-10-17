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
  /** Température du palier d'empâtage principal (°C). Absente = température de référence (aucun ajustement). */
  mashTempC?: number
}

/** Atténuation par défaut (%) quand la recette n'a pas encore de levure. */
export const DEFAULT_ATTENUATION_PERCENT = 75

/**
 * Température d'empâtage à laquelle on considère que l'atténuation annoncée par
 * le fabricant de levure s'applique telle quelle. C'est aussi la valeur par défaut
 * d'une recette : sans réglage explicite, les estimations ne bougent pas.
 */
export const REFERENCE_MASH_TEMP_C = 67

/** Plage où l'ajustement a un sens : en dehors, les enzymes ne travaillent plus de façon représentative. */
const MASH_TEMP_MIN_C = 62
const MASH_TEMP_MAX_C = 72

/** Points d'atténuation perdus (ou gagnés) par °C au-dessus (ou en dessous) de la référence. */
const ATTENUATION_POINTS_PER_C = 1

/**
 * Ajuste l'atténuation apparente selon la température d'empâtage.
 * Plus chaud → l'alpha-amylase domine, le moût contient plus de sucres non
 * fermentescibles (dextrines) : FG plus haute, bière plus ronde, moins d'alcool.
 * Plus froid → la bêta-amylase domine : moût plus fermentescible, bière plus sèche.
 * Règle empirique (≈ 1 point par °C), pas un modèle enzymatique : à traiter comme une tendance.
 */
export function adjustAttenuationForMashTemp(attenuationPercent: number, mashTempC: number): number {
  const clamped = Math.min(MASH_TEMP_MAX_C, Math.max(MASH_TEMP_MIN_C, mashTempC))
  return attenuationPercent - (clamped - REFERENCE_MASH_TEMP_C) * ATTENUATION_POINTS_PER_C
}

/**
 * Estimations d'une recette (OG, FG, IBU, SRM, ABV) — source unique utilisée
 * par le formulaire, l'enregistrement d'une recette et la recette d'un brassin.
 * Garetz demande des volumes d'ébullition absents ici : Tinseth est utilisé en repli.
 */
export function estimateRecipeStats(input: RecipeStatsInput): RecipeStats {
  const { fermentables, hops, yeasts, targetVolumeL, mashEfficiencyPercent, ibuFormula } = input
  const mashTempC = input.mashTempC ?? REFERENCE_MASH_TEMP_C
  const og = calculateOG(fermentables, targetVolumeL, mashEfficiencyPercent)
  const attenuation = adjustAttenuationForMashTemp(
    yeasts[0]?.attenuationPercent ?? DEFAULT_ATTENUATION_PERCENT,
    mashTempC,
  )
  const fg = calculateFG(og, attenuation)
  const ibu =
    ibuFormula === 'rager'
      ? calculateIBU_Rager(hops, og, targetVolumeL)
      : calculateIBU_Tinseth(hops, og, targetVolumeL)
  const srm = calculateSRM(fermentables, targetVolumeL)
  const abv = calculateABV(og, fg)
  return { og, fg, ibu, srm, abv }
}
