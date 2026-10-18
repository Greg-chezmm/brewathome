import type { Yeast, YeastStyle } from './types'

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

/**
 * Poids d'un sachet de levure sèche d'après la marque (nom, ou laboratoire s'il est connu) :
 * Fermentis (SafAle, SafLager…) 11,5 g, Lallemand (LalBrew…) 11 g, Mangrove Jack's 10 g.
 * Marque inconnue : 11,5 g, le format le plus courant.
 */
export function dryYeastSachetGrams(nameOrLaboratory: string): number {
  const name = nameOrLaboratory.toLowerCase()
  if (/mangrove|\bm\d{2}\b/.test(name)) return 10
  if (/lal|lallemand|windsor|nottingham|verdant|voss/.test(name)) return 11
  return DRY_YEAST_SACHET_G
}

/** Cellules d'un sachet ou tube de levure liquide neuf (Wyeast, White Labs), en milliards. */
export const LIQUID_PACK_BILLION_CELLS = 100

/** En dessous de 90 % de la quantité conseillée, la levure est jugée insuffisante. */
const PITCH_TOLERANCE = 0.9

export interface YeastPitchCheck {
  /** Unité de comparaison : grammes de levure sèche ou milliards de cellules (liquide). */
  unit: 'g' | 'cells'
  /** Quantité conseillée, dans `unit`. */
  needed: number
  /** Quantité prévue par la recette, dans `unit` ; null si non renseignée ou non convertible (ml…). */
  planned: number | null
  /** Sachets (ou tubes) conseillés. */
  packs: number
  /** Poids d'un sachet de levure sèche (g) ; null pour une levure liquide. */
  sachetG: number | null
  /** missing : quantité absente ; unknown : unité non comparable ; low : insuffisante ; ok. */
  status: 'missing' | 'unknown' | 'low' | 'ok'
}

/**
 * Levure à ensemencer pour `volumeL` litres de moût à la densité `og`, comparée à la quantité prévue.
 * Même taux que l'outil d'ensemencement (Mr Malty : 0,75 million de cellules/mL/°P en ale, le double
 * en lager ; 10 milliards de cellules par gramme de levure sèche, 100 milliards par sachet liquide neuf).
 */
export function checkYeastPitch(yeast: Yeast, volumeL: number, og: number): YeastPitchCheck {
  const cells = calculateCellsNeededBillions(volumeL, og, yeast.style)
  const hasAmount = yeast.amount !== undefined && Number.isFinite(yeast.amount) && yeast.amount > 0
  const unit = yeast.amountUnit ?? 'pkg'

  let check: Omit<YeastPitchCheck, 'status'>
  if (yeast.type === 'dry') {
    const sachetG = yeast.sachetG && yeast.sachetG > 0 ? yeast.sachetG : dryYeastSachetGrams(yeast.name)
    const needed = cells / DRY_YEAST_BILLION_CELLS_PER_G
    const planned = !hasAmount ? null : unit === 'g' ? yeast.amount! : unit === 'pkg' ? yeast.amount! * sachetG : null
    check = { unit: 'g', needed, planned, packs: Math.max(1, Math.ceil((needed * PITCH_TOLERANCE) / sachetG)), sachetG }
  } else {
    const planned = hasAmount && unit === 'pkg' ? yeast.amount! * LIQUID_PACK_BILLION_CELLS : null
    const packs = Math.max(1, Math.ceil((cells * PITCH_TOLERANCE) / LIQUID_PACK_BILLION_CELLS))
    check = { unit: 'cells', needed: cells, planned, packs, sachetG: null }
  }

  const status = !hasAmount
    ? 'missing'
    : check.planned === null
      ? 'unknown'
      : check.planned < check.needed * PITCH_TOLERANCE
        ? 'low'
        : 'ok'
  return { ...check, status }
}
