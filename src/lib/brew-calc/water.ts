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

export interface WaterTarget {
  id: string
  label: string
  /** Bières pour lesquelles ce profil convient. */
  examples: string
  profile: WaterProfile
}

/**
 * Profils cibles usuels (repères de brasseurs amateurs, à ajuster au goût) : on joue surtout sur
 * le calcium et le rapport sulfates/chlorures, le magnésium et le sodium restent discrets.
 */
export const WATER_TARGETS: WaterTarget[] = [
  {
    id: 'light',
    label: 'Légère',
    examples: 'pils, lager blonde, blanche',
    profile: { calcium: 50, magnesium: 5, sodium: 10, sulfate: 60, chloride: 60, bicarbonate: 0 },
  },
  {
    id: 'balanced',
    label: 'Équilibrée',
    examples: 'blonde, ambrée, saison, bière belge',
    profile: { calcium: 75, magnesium: 10, sodium: 15, sulfate: 100, chloride: 100, bicarbonate: 0 },
  },
  {
    id: 'hoppy',
    label: 'Houblonnée sèche',
    examples: 'IPA, pale ale, bitter',
    profile: { calcium: 100, magnesium: 10, sodium: 15, sulfate: 250, chloride: 60, bicarbonate: 0 },
  },
  {
    id: 'juicy',
    label: 'Houblonnée ronde',
    examples: 'NEIPA, hazy IPA',
    profile: { calcium: 100, magnesium: 10, sodium: 15, sulfate: 100, chloride: 200, bicarbonate: 0 },
  },
  {
    id: 'malty',
    label: 'Maltée',
    examples: 'stout, porter, brune, scotch ale, barley wine',
    profile: { calcium: 75, magnesium: 10, sodium: 30, sulfate: 60, chloride: 120, bicarbonate: 0 },
  },
]

/** Poids de chaque ion dans le calcul : calcium et équilibre sulfates/chlorures d'abord. */
const ION_WEIGHTS: Record<keyof WaterProfile, number> = {
  calcium: 1,
  magnesium: 0.5,
  sodium: 0.5,
  sulfate: 1,
  chloride: 1,
  bicarbonate: 0.5,
}

/**
 * Grammes de sels à ajouter pour approcher le profil cible (moindres carrés, quantités positives,
 * arrondies au dixième de gramme). Les ions déjà au-dessus de la cible ne peuvent pas être retirés
 * par des sels : voir `ionsAboveTarget`.
 */
export function suggestSalts(
  source: WaterProfile,
  target: WaterProfile,
  waterVolumeL: number,
  salts: BrewingSalt[] = Object.keys(SALT_PPM_PER_G_PER_L) as BrewingSalt[],
): Partial<Record<BrewingSalt, number>> {
  if (waterVolumeL <= 0) return {}
  // Écart relatif : 10 ppm de trop pèsent plus sur 20 ppm visés que sur 200.
  const scale = (ion: keyof WaterProfile) => ION_WEIGHTS[ion] / Math.max(target[ion], 20) ** 2
  const gramsPerL = salts.map(() => 0)
  const residual = IONS.map((ion) => source[ion] - target[ion])
  // Descente par coordonnées : chaque sel est ajusté à son optimum (positif) en tenant compte des autres.
  for (let iteration = 0; iteration < 500; iteration++) {
    salts.forEach((salt, j) => {
      let gradient = 0
      let curvature = 0
      IONS.forEach((ion, i) => {
        const ppm = SALT_PPM_PER_G_PER_L[salt][ion] ?? 0
        gradient += scale(ion) * residual[i] * ppm
        curvature += scale(ion) * ppm * ppm
      })
      const next = Math.max(0, gramsPerL[j] - gradient / curvature)
      const delta = next - gramsPerL[j]
      if (delta === 0) return
      gramsPerL[j] = next
      IONS.forEach((ion, i) => {
        residual[i] += delta * (SALT_PPM_PER_G_PER_L[salt][ion] ?? 0)
      })
    })
  }
  const grams: Partial<Record<BrewingSalt, number>> = {}
  salts.forEach((salt, j) => {
    const rounded = Math.round(gramsPerL[j] * waterVolumeL * 10) / 10
    if (rounded > 0) grams[salt] = rounded
  })
  return grams
}

/** Ions que l'eau de départ apporte déjà en excès (au-delà de 20 % et 10 ppm de la cible). */
export function ionsAboveTarget(source: WaterProfile, target: WaterProfile): (keyof WaterProfile)[] {
  return IONS.filter((ion) => source[ion] > target[ion] * 1.2 + 10)
}

/**
 * Alcalinité résiduelle (Kolbach), en ppm de CaCO3 : alcalinité de l'eau moins l'effet acidifiant
 * du calcium et du magnésium. Proche de 0 ou négative pour une bière claire, plus haute pour une
 * bière sombre (les malts torréfiés acidifient l'empâtage).
 */
export function residualAlkalinity(profile: WaterProfile): number {
  const alkalinity = (profile.bicarbonate * 50) / 61
  return alkalinity - profile.calcium / 3.5 - profile.magnesium / 7
}
