import type { Fermentable } from './types'
import { litersToGallons, kgToLb } from './units'

/**
 * Potentiel d'extrait du saccharose pur (référence 100% de rendement),
 * en points par livre et par gallon US (PPG). C'est la base de la convention
 * BeerXML où YIELD% est exprimé relativement à cette valeur.
 */
const SUCROSE_PPG = 46

function fermentablePoints(fermentable: Fermentable, mashEfficiencyPercent: number): number {
  const weightLb = kgToLb(fermentable.amountKg)
  const ppg = (fermentable.yieldPercent / 100) * SUCROSE_PPG
  // L'efficacité de brassage ne s'applique qu'aux grains empâtés : un extrait
  // ou un sucre ajouté directement est déjà à 100% de son potentiel soluble.
  const efficiency = fermentable.type === 'grain' ? mashEfficiencyPercent / 100 : 1
  return weightLb * ppg * efficiency
}

/** Densité initiale (OG) estimée à partir de la recette. */
export function calculateOG(
  fermentables: Fermentable[],
  volumeL: number,
  mashEfficiencyPercent: number,
): number {
  const volumeGal = litersToGallons(volumeL)
  const totalPoints = fermentables.reduce(
    (sum, f) => sum + fermentablePoints(f, mashEfficiencyPercent),
    0,
  )
  const ogPoints = totalPoints / volumeGal
  return 1 + ogPoints / 1000
}

/** Densité finale (FG) estimée à partir de l'OG et de l'atténuation apparente de la levure. */
export function calculateFG(og: number, attenuationPercent: number): number {
  return og - (og - 1) * (attenuationPercent / 100)
}
