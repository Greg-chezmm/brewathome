import { calculateABV_simple } from './abv'
import { calculateSRM } from './color'
import { calculateFG, extractPointsLiters } from './gravity'
import { calculateIBU_Rager, garetzContributions, tinsethContributions } from './ibu'
import type { EquipmentProfile, Fermentable, Hop, IBUFormulaName, RecipeStats, Yeast } from './types'
import { srmToEbc } from './units'
import { calculateVolumes, type VolumeBreakdown } from './volumes'

export interface RecipeStatsInput {
  fermentables: Fermentable[]
  hops: Hop[]
  yeasts: Yeast[]
  /** Volume visé dans le fermenteur (L). */
  targetVolumeL: number
  mashEfficiencyPercent: number
  ibuFormula: IBUFormulaName
  /** Température du palier d'empâtage principal (°C). Absente = température de référence (aucun ajustement). */
  mashTempC?: number
  /** Durée d'ébullition (min) : évaporation et temps de contact des houblons premier moût. */
  boilTimeMin?: number
  /**
   * Profil d'équipement : donne les pertes (donc le volume de fin d'ébullition sur lequel
   * se calculent DI, couleur et IBU), l'évaporation et l'utilisation houblon. Sans profil,
   * on calcule sur le volume du fermenteur, sans pré-ébullition connue.
   */
  equipment?: EquipmentProfile | null
}

/** Résultat complet du moteur de calcul (specs « Ordre des calculs »). */
export interface RecipeCalculation extends RecipeStats {
  /** Volumes à chaque étape (§1) — null sans profil d'équipement. */
  volumes: VolumeBreakdown | null
  /** Volume sur lequel se calculent DI, couleur et IBU : fin d'ébullition à froid (ou fermenteur sans équipement). */
  calculationVolumeL: number
  /** Densité avant ébullition (§2) — null sans profil d'équipement. */
  preBoilGravity: number | null
  /** Densité de fin d'ébullition, refroidie : la DI sans les ajouts faits en fermenteur. */
  postBoilGravity: number
  /** Densité d'ébullition utilisée pour l'IBU : moyenne pré-ébullition / DI hors ajouts en fermentation. */
  boilGravity: number
  /** Couleur en EBC (§3). */
  ebc: number
  /** IBU de chaque houblon, dans l'ordre de la recette (§4, Tinseth ou Garetz ; vide en Rager). */
  ibuByHop: number[]
  /** Atténuation retenue (%), après ajustement éventuel par la température d'empâtage. */
  attenuationPercent: number
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
 * Moteur de calcul d'une recette, dans l'ordre des specs :
 * §1 volumes → §2 densités → §3 couleur → §4 amertume → §5 DF et ABV.
 */
export function computeRecipe(input: RecipeStatsInput): RecipeCalculation {
  const { fermentables, hops, yeasts, targetVolumeL, mashEfficiencyPercent, ibuFormula, equipment } = input
  const boilTimeMin = input.boilTimeMin ?? equipment?.boilTimeMin ?? 60
  const mashTempC = input.mashTempC ?? REFERENCE_MASH_TEMP_C

  // §1 — Volumes, à rebours depuis le fermenteur.
  const grainKg = fermentables.filter((f) => f.type === 'grain').reduce((sum, f) => sum + f.amountKg, 0)
  const volumes = equipment ? calculateVolumes(targetVolumeL, grainKg, boilTimeMin, equipment) : null
  const calculationVolumeL = volumes?.endOfBoilColdVolumeL ?? targetVolumeL

  // §2 — Densités. Les ajouts en fermentation comptent dans la DI, pas dans le moût bouilli.
  const boiledPoints = extractPointsLiters(fermentables, mashEfficiencyPercent, ['mash', 'boil'])
  const allPoints = extractPointsLiters(fermentables, mashEfficiencyPercent)
  const og = 1 + allPoints / calculationVolumeL / 1000
  const boiledOg = 1 + boiledPoints / calculationVolumeL / 1000
  const preBoilGravity = volumes ? 1 + boiledPoints / volumes.preBoilVolumeL / 1000 : null
  const boilGravity = preBoilGravity !== null ? (preBoilGravity + boiledOg) / 2 : boiledOg

  // §3 — Couleur (Morey).
  const srm = calculateSRM(fermentables, calculationVolumeL)

  // §4 — Amertume. Garetz : CF = fin d'ébullition / pré-ébullition (1 sans équipement).
  const hopOptions = { boilTimeMin, hopUtilizationPercent: equipment?.hopUtilizationPercent }
  const ibuByHop =
    ibuFormula === 'rager'
      ? []
      : ibuFormula === 'garetz'
        ? garetzContributions(hops, boilGravity, calculationVolumeL, {
            ...hopOptions,
            boilVolumeL: volumes?.preBoilVolumeL,
          })
        : tinsethContributions(hops, boilGravity, calculationVolumeL, hopOptions)
  const ibu =
    ibuFormula === 'rager'
      ? calculateIBU_Rager(hops, boilGravity, calculationVolumeL)
      : ibuByHop.reduce((sum, value) => sum + value, 0)

  // §5 — Densité finale et alcool.
  const attenuationPercent = adjustAttenuationForMashTemp(
    yeasts[0]?.attenuationPercent ?? DEFAULT_ATTENUATION_PERCENT,
    mashTempC,
  )
  const fg = calculateFG(og, attenuationPercent)
  const abv = calculateABV_simple(og, fg)

  return {
    og,
    fg,
    ibu,
    srm,
    abv,
    ebc: srmToEbc(srm),
    volumes,
    calculationVolumeL,
    preBoilGravity,
    postBoilGravity: boiledOg,
    boilGravity,
    ibuByHop,
    attenuationPercent,
  }
}

/** Estimations d'une recette (OG, FG, IBU, SRM, ABV) — voir `computeRecipe` pour le détail. */
export function estimateRecipeStats(input: RecipeStatsInput): RecipeStats {
  const { og, fg, ibu, srm, abv } = computeRecipe(input)
  return { og, fg, ibu, srm, abv }
}
