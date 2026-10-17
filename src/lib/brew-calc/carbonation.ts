import { celsiusToFahrenheit } from './units'

export type PrimingSugar = 'sucrose' | 'dextrose' | 'dme'

/** Masse de sucre à prévoir par rapport au saccharose, à CO2 égal (specs §7). */
const PRIMING_SUGAR_FACTORS: Record<PrimingSugar, number> = {
  sucrose: 1,
  dextrose: 1.1,
  dme: 1.4,
}

export const PRIMING_SUGAR_LABELS: Record<PrimingSugar, string> = {
  sucrose: 'Saccharose (sucre blanc)',
  dextrose: 'Dextrose',
  dme: 'Extrait de malt sec',
}

/**
 * CO2 déjà dissous dans la bière en fin de fermentation (volumes), selon la
 * température maximale atteinte en fin de fermentation (specs §7).
 */
export function residualCO2Volumes(fermentationTempC: number): number {
  const t = celsiusToFahrenheit(fermentationTempC)
  return 3.0378 - 0.050062 * t + 0.00026555 * t ** 2
}

/**
 * Sucre de resucrage (g) pour atteindre \`targetCO2Volumes\` dans \`bottledVolumeL\` :
 * 4,0 g/L par volume de CO2 manquant en saccharose, × 1,1 en dextrose, × 1,4 en extrait sec.
 * Retourne 0 si la bière contient déjà assez de CO2.
 */
export function primingSugarGrams(
  targetCO2Volumes: number,
  fermentationTempC: number,
  bottledVolumeL: number,
  sugar: PrimingSugar = 'sucrose',
): number {
  const missing = targetCO2Volumes - residualCO2Volumes(fermentationTempC)
  return Math.max(0, 4.0 * missing * bottledVolumeL * PRIMING_SUGAR_FACTORS[sugar])
}
