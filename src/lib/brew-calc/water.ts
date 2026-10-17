/** Profil d'eau : concentrations en ions, en ppm (mg/L). */
export interface WaterProfile {
  calcium: number
  magnesium: number
  sodium: number
  sulfate: number
  chloride: number
  bicarbonate: number
}

export type BrewingSalt = 'gypsum' | 'calciumChloride' | 'epsom' | 'tableSalt' | 'bakingSoda'

export const BREWING_SALT_LABELS: Record<BrewingSalt, string> = {
  gypsum: 'Gypse (CaSO4·2H2O)',
  calciumChloride: 'Chlorure de calcium (CaCl2·2H2O)',
  epsom: "Sel d'Epsom (MgSO4·7H2O)",
  tableSalt: 'Sel de table (NaCl)',
  bakingSoda: 'Bicarbonate de soude (NaHCO3)',
}

/** Apport en ppm pour 1 g de sel dissous dans 1 L (specs §6). */
export const SALT_PPM_PER_G_PER_L: Record<BrewingSalt, Partial<WaterProfile>> = {
  gypsum: { calcium: 232.8, sulfate: 557.7 },
  calciumChloride: { calcium: 272.6, chloride: 482.3 },
  epsom: { magnesium: 98.6, sulfate: 389.6 },
  tableSalt: { sodium: 393.4, chloride: 606.6 },
  bakingSoda: { sodium: 273.7, bicarbonate: 726.4 },
}

const IONS: (keyof WaterProfile)[] = ['calcium', 'magnesium', 'sodium', 'sulfate', 'chloride', 'bicarbonate']

/**
 * Profil obtenu en ajoutant des sels (g) à un volume d'eau (L) de profil \`source\` :
 * chaque sel apporte (ppm pour 1 g/L) × (g / L).
 */
export function applySalts(
  source: WaterProfile,
  saltsGrams: Partial<Record<BrewingSalt, number>>,
  waterVolumeL: number,
): WaterProfile {
  const result = { ...source }
  for (const [salt, grams] of Object.entries(saltsGrams) as [BrewingSalt, number][]) {
    const gramsPerL = grams / waterVolumeL
    for (const ion of IONS) {
      result[ion] += (SALT_PPM_PER_G_PER_L[salt][ion] ?? 0) * gramsPerL
    }
  }
  return result
}

/** Rapport sulfates/chlorures : > 1,5 accentue l'amertume (sec), < 0,8 la rondeur maltée. */
export function sulfateToChlorideRatio(profile: WaterProfile): number {
  return profile.chloride > 0 ? profile.sulfate / profile.chloride : Number.POSITIVE_INFINITY
}
