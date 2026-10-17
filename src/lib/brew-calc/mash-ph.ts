import { findByName, FERMENTABLE_LIBRARY, type FermentableCategory } from '@/data/ingredients'
import { fermentableUse } from './gravity'
import type { Fermentable } from './types'

/**
 * Estimation du pH d'empâtage (modèle de Troester, simplifié) : chaque malt a un pH « eau
 * distillée » (DI) et un pouvoir tampon ; l'alcalinité de l'eau le remonte, les acides le baissent.
 *   pH = pH_DI du mélange + (alcalinité de l'eau − acides) / pouvoir tampon total
 * Précision attendue : ±0,1 à 0,2. Rien ne remplace une mesure au pH-mètre.
 */

export type MashGrainKind = 'base' | 'adjunct' | 'crystal' | 'roasted' | 'acid'

/** Pouvoir tampon des malts (mEq par kg et par unité de pH). */
const BUFFER_MEQ_PER_KG_PH: Record<MashGrainKind, number> = {
  base: 40,
  adjunct: 25,
  crystal: 70,
  roasted: 80,
  acid: 40,
}

/** Acidité du malt acidulé : ≈ 2–3 % d'acide lactique, soit ≈ 0,1 pH de moins par % du grain. */
export const ACID_MALT_MEQ_PER_KG = 300
/** Acide lactique à 88 % : mEq d'acide par mL. */
export const LACTIC_ACID_88_MEQ_PER_ML = 11.8
/** Bicarbonate de soude : mEq d'alcalinité par gramme (84 g/mol). */
export const BAKING_SODA_MEQ_PER_G = 11.9
/** Plage visée : 5,2 à 5,6 ; 5,4 convient à presque toutes les bières. */
export const MASH_PH_TARGET = 5.4
export const MASH_PH_RANGE: [number, number] = [5.2, 5.6]
/** Ratio eau/grain supposé sans profil d'équipement (L/kg). */
export const DEFAULT_MASH_RATIO_L_PER_KG = 3

/** Famille d'un grain pour le pH : d'après la bibliothèque, à défaut d'après son nom et sa couleur. */
export function mashGrainKind(f: Pick<Fermentable, 'name' | 'colorLovibond'>): MashGrainKind {
  const name = f.name.toLowerCase()
  if (/acidul|sauer|acide?\b|acid malt/.test(name)) return 'acid'
  const category: FermentableCategory | undefined = findByName(FERMENTABLE_LIBRARY, f.name)?.category
  if (category === 'roasted' || /carafa|chocolat|black|noir|torréfi|roast/.test(name) || f.colorLovibond >= 200) return 'roasted'
  if (category === 'caramel' || /crystal|caramel|cara|special b/.test(name)) return 'crystal'
  if (category === 'adjunct' || /flocon|flake|cru\b/.test(name)) return 'adjunct'
  return 'base'
}

/** pH DI d'un grain : les malts touraillés baissent avec la couleur, les caramel suivent Troester. */
export function grainDiPh(kind: MashGrainKind, colorLovibond: number): number {
  const color = Number.isFinite(colorLovibond) ? colorLovibond : 2
  switch (kind) {
    case 'roasted':
      return 4.5
    case 'crystal':
      return Math.max(4.4, 5.22 - 0.00504 * color)
    case 'adjunct':
      return 5.9
    default:
      return Math.min(5.8, Math.max(5.3, 5.72 - 0.018 * (color - 2)))
  }
}

export interface MashPhInput {
  fermentables: Fermentable[]
  /** Eau d'empâtage (L). */
  mashWaterL: number
  /** Alcalinité résiduelle de l'eau d'empâtage, en ppm de CaCO3 (voir `residualAlkalinity`). */
  residualAlkalinityPpm: number
  /** Acide lactique 88 % ajouté à l'empâtage (mL). */
  lacticAcidMl?: number
}

export interface MashPhEstimate {
  /** pH du grain seul, dans de l'eau distillée. */
  diPh: number
  ph: number
  /** Pouvoir tampon total de la maische (mEq/pH). */
  bufferMEqPerPh: number
  /** Part de malt acidulé dans le grain (%). */
  acidMaltPercent: number
  /** Acide lactique 88 % à ajouter (en plus de celui saisi) pour viser 5,4 ; 0 si déjà en dessous. */
  lacticMlToTarget: number
  /** Bicarbonate de soude pour remonter à 5,4 si le pH est trop bas (bières très sombres, eau douce). */
  bakingSodaGToTarget: number
}

/** Estime le pH d'empâtage. Null sans grain à l'empâtage. */
export function estimateMashPh(input: MashPhInput, target = MASH_PH_TARGET): MashPhEstimate | null {
  const grains = input.fermentables.filter(
    (f) => fermentableUse(f) === 'mash' && f.type === 'grain' && Number.isFinite(f.amountKg) && f.amountKg > 0,
  )
  const totalKg = grains.reduce((sum, f) => sum + f.amountKg, 0)
  if (totalKg <= 0) return null

  let buffer = 0
  let weightedPh = 0
  let acidMEq = 0
  let acidMaltKg = 0
  for (const f of grains) {
    const kind = mashGrainKind(f)
    const b = f.amountKg * BUFFER_MEQ_PER_KG_PH[kind]
    buffer += b
    // Le malt acidulé compte comme un malt de base très clair, plus son acide lactique.
    weightedPh += b * grainDiPh(kind === 'acid' ? 'base' : kind, kind === 'acid' ? 2 : f.colorLovibond)
    if (kind === 'acid') {
      acidMEq += f.amountKg * ACID_MALT_MEQ_PER_KG
      acidMaltKg += f.amountKg
    }
  }
  const diPh = weightedPh / buffer
  const lacticMEq = Math.max(0, input.lacticAcidMl ?? 0) * LACTIC_ACID_88_MEQ_PER_ML
  const waterMEq = (input.residualAlkalinityPpm / 50) * Math.max(0, input.mashWaterL)
  const ph = diPh + (waterMEq - acidMEq - lacticMEq) / buffer

  const round = (value: number, step: number) => Math.round(value / step) * step
  return {
    diPh,
    ph,
    bufferMEqPerPh: buffer,
    acidMaltPercent: (acidMaltKg / totalKg) * 100,
    lacticMlToTarget: ph > target ? round(((ph - target) * buffer) / LACTIC_ACID_88_MEQ_PER_ML, 0.1) : 0,
    bakingSodaGToTarget: ph < target ? round(((target - ph) * buffer) / BAKING_SODA_MEQ_PER_G, 0.5) : 0,
  }
}

/** Ce que donne ce pH, en une phrase. */
export function mashPhVerdict(ph: number): string {
  if (ph < 5.0) return 'Trop acide : rendement et fermentescibilité en baisse, goût aigrelet possible.'
  if (ph < MASH_PH_RANGE[0]) return 'Un peu bas : bière plus vive et plus sèche, acceptable pour les bières sombres.'
  if (ph <= MASH_PH_RANGE[1]) return 'Dans la bonne plage : enzymes efficaces, goût net.'
  if (ph <= 5.8) return 'Un peu haut : rendement correct mais goût plus terne, amertume plus dure, risque de tanins au rinçage.'
  return 'Trop haut : extraction de tanins (astringence), amertume râpeuse. Acidifiez.'
}
