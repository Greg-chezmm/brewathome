import { extractPointsLiters } from './gravity'
import type { Fermentable } from './types'
import { kgToLb } from './units'

/** Part d'un fermentable dans la recette, pour afficher l'effet de chaque ingrédient. */
export interface FermentableContribution {
  /** Part du poids total des fermentables, en %. */
  percentOfGrist: number
  /** Points de densité apportés à la DI (ex. 31 = +0.031), sur le volume de calcul. */
  gravityPoints: number
  /** Part de la couleur (MCU) apportée, en %. */
  colorPercent: number
}

/**
 * Contribution de chaque fermentable, dans l'ordre de `fermentables` : poids, densité
 * (même extrait que le moteur, specs §2) et couleur (part des MCU de Morey, §3).
 */
export function fermentableContributions(
  fermentables: Fermentable[],
  mashEfficiencyPercent: number,
  calculationVolumeL: number,
): FermentableContribution[] {
  const totalKg = fermentables.reduce((sum, f) => sum + safe(f.amountKg), 0)
  const mcu = (f: Fermentable) => kgToLb(safe(f.amountKg)) * safe(f.colorLovibond)
  const totalMcu = fermentables.reduce((sum, f) => sum + mcu(f), 0)
  return fermentables.map((f) => ({
    percentOfGrist: totalKg > 0 ? (safe(f.amountKg) / totalKg) * 100 : 0,
    gravityPoints:
      calculationVolumeL > 0
        ? extractPointsLiters([{ ...f, amountKg: safe(f.amountKg), yieldPercent: safe(f.yieldPercent) }], mashEfficiencyPercent) /
          calculationVolumeL
        : 0,
    colorPercent: totalMcu > 0 ? (mcu(f) / totalMcu) * 100 : 0,
  }))
}

/** Rapport amertume / densité (BU:GU) : ≈ 0,5 équilibré, < 0,4 malté, > 0,8 très amer. */
export function buGuRatio(ibu: number, og: number): number | null {
  const gravityUnits = (og - 1) * 1000
  return gravityUnits > 0 ? ibu / gravityUnits : null
}

/** Valeur en cours de saisie (champ vidé = NaN) : comptée comme 0. */
function safe(value: number): number {
  return Number.isFinite(value) ? value : 0
}
