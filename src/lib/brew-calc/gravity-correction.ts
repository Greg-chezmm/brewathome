import { litersToGallons, lbToKg } from './units'

export interface DilutionResult {
  waterToAddL: number
  newVolumeL: number
}

/**
 * Calcule le volume d'eau à ajouter pour ramener une densité mesurée trop
 * élevée à la densité cible, par conservation des points de densité
 * (points = (SG-1)x1000, proportionnels à la masse de sucre dissous) :
 * V2 = V1 x points1 / points2.
 */
export function calculateDilutionWater(
  currentVolumeL: number,
  currentGravity: number,
  targetGravity: number,
): DilutionResult {
  if (!(currentVolumeL > 0)) {
    throw new Error('Le volume à diluer doit être supérieur à 0.')
  }
  if (!(targetGravity > 1)) {
    throw new Error('La densité cible doit être supérieure à 1.000.')
  }
  if (targetGravity >= currentGravity) {
    throw new Error(
      'La densité cible doit être inférieure à la densité mesurée pour calculer une dilution.',
    )
  }
  const currentPoints = (currentGravity - 1) * 1000
  const targetPoints = (targetGravity - 1) * 1000
  const newVolumeL = (currentVolumeL * currentPoints) / targetPoints
  return { waterToAddL: newVolumeL - currentVolumeL, newVolumeL }
}

export type FermentableAdditionType = 'tableSugar' | 'dextrose' | 'dme' | 'lme'

/**
 * Potentiel d'extrait (PPG imperial) des matières couramment utilisées pour
 * corriger une densité trop basse. LME est plus bas que DME du fait de sa
 * teneur en eau résiduelle (~20%).
 */
const ADDITION_PPG: Record<FermentableAdditionType, number> = {
  tableSugar: 46,
  dextrose: 42,
  dme: 42,
  lme: 36,
}

export const FERMENTABLE_ADDITION_LABELS: Record<FermentableAdditionType, string> = {
  tableSugar: 'Sucre de table (saccharose)',
  dextrose: 'Dextrose (glucose)',
  dme: 'Extrait de malt sec (DME)',
  lme: 'Extrait de malt liquide (LME)',
}

export interface FermentableAdditionResult {
  gramsToAdd: number
}

/**
 * Calcule la quantité (g) de matière fermentescible à ajouter pour ramener
 * une densité mesurée trop basse à la densité cible. Hypothèse simplificatrice :
 * l'ajout ne modifie pas sensiblement le volume.
 */
export function calculateFermentableAddition(
  currentVolumeL: number,
  currentGravity: number,
  targetGravity: number,
  additionType: FermentableAdditionType,
): FermentableAdditionResult {
  if (targetGravity <= currentGravity) {
    throw new Error(
      'La densité cible doit être supérieure à la densité mesurée pour calculer un ajout de matière fermentescible.',
    )
  }
  const currentPoints = (currentGravity - 1) * 1000
  const targetPoints = (targetGravity - 1) * 1000
  const pointsNeededTotal = (targetPoints - currentPoints) * litersToGallons(currentVolumeL)
  const poundsNeeded = pointsNeededTotal / ADDITION_PPG[additionType]
  return { gramsToAdd: lbToKg(poundsNeeded) * 1000 }
}

/** Température d'étalonnage des densimètres courants. */
export const HYDROMETER_CALIBRATION_C = 20

const waterDensityFactor = (tempF: number) =>
  1.00130346 - 0.000134722124 * tempF + 0.00000204052596 * tempF ** 2 - 0.00000000232820948 * tempF ** 3

/**
 * Ramène à la température d'étalonnage une densité lue au densimètre sur un échantillon
 * plus chaud (ou plus froid) : le liquide se dilate et le densimètre lit trop bas à chaud.
 * Formule usuelle du densimètre (polynôme de dilatation de l'eau, °F en interne).
 */
export function correctGravityForTemperature(
  reading: number,
  sampleTempC: number,
  calibrationTempC = HYDROMETER_CALIBRATION_C,
): number {
  const toF = (c: number) => (c * 9) / 5 + 32
  return reading * (waterDensityFactor(toF(sampleTempC)) / waterDensityFactor(toF(calibrationTempC)))
}
