import type { YeastStyle } from './types'

/**
 * Conversion densité spécifique (SG) -> degrés Plato, formule ASBC standard.
 */
export function sgToPlato(sg: number): number {
  return -616.868 + 1111.14 * sg - 630.272 * sg ** 2 + 135.997 * sg ** 3
}

/**
 * Taux de pitch recommandé (Mr Malty / Jamil Zainasheff), en millions de
 * cellules viables par mL et par degré Plato.
 */
export function pitchRatePerMlPerPlato(style: YeastStyle): number {
  return style === 'lager' ? 1.5 : 0.75
}

/** Nombre total de cellules viables nécessaires, en milliards. */
export function calculateCellsNeededBillions(
  volumeL: number,
  og: number,
  style: YeastStyle,
): number {
  const plato = sgToPlato(og)
  const rate = pitchRatePerMlPerPlato(style)
  const volumeMl = volumeL * 1000
  const cellsNeededMillions = rate * volumeMl * plato
  return cellsNeededMillions / 1000
}

/**
 * Viabilité approximative d'un sachet/vial de levure liquide selon son âge.
 * Modèle linéaire Mr Malty (reconnu comme une approximation : des données
 * plus récentes White Labs PurePitch montrent un déclin non linéaire).
 */
export function calculateLiquidYeastViabilityPercent(ageDays: number): number {
  return Math.max(0, 97 - 0.7 * ageDays)
}

/** Nombre de sachets/vials de levure liquide à prévoir pour atteindre le taux de pitch visé. */
export function calculateLiquidPacksNeeded(
  cellsNeededBillions: number,
  ageDays: number,
  packSizeBillion = 100,
): number {
  const viability = calculateLiquidYeastViabilityPercent(ageDays) / 100
  const viableCellsPerPack = packSizeBillion * viability
  if (viableCellsPerPack <= 0) return Number.POSITIVE_INFINITY
  return Math.ceil(cellsNeededBillions / viableCellsPerPack)
}

export interface DryYeastRange {
  minGrams: number
  maxGrams: number
}

/**
 * Quantité de levure sèche recommandée en g/L (plage usuelle du secteur,
 * pas de taux de pitch en cellules/mL publié de façon uniforme par souche).
 */
export function calculateDryYeastGrams(volumeL: number, style: YeastStyle): DryYeastRange {
  const [minRate, maxRate] = style === 'lager' ? [1.0, 1.5] : [0.75, 1.0]
  return { minGrams: volumeL * minRate, maxGrams: volumeL * maxRate }
}

/** Cellules viables par gramme de levure sèche, en milliards (specs §8). */
export const DRY_YEAST_BILLION_CELLS_PER_G = 10

/** Taille usuelle d'un sachet de levure sèche, en grammes. */
export const DRY_YEAST_SACHET_G = 11.5

/** Levure sèche nécessaire pour un nombre de cellules donné : grammes et nombre de sachets (arrondi au-dessus). */
export function dryYeastForCells(
  cellsNeededBillions: number,
  sachetGrams = DRY_YEAST_SACHET_G,
): { grams: number; sachets: number } {
  const grams = cellsNeededBillions / DRY_YEAST_BILLION_CELLS_PER_G
  return { grams, sachets: Math.max(1, Math.ceil(grams / sachetGrams)) }
}
