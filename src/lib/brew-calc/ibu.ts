import type { Hop } from './types'
import { M_PER_FT } from './units'

function contributingHops(hops: Hop[]): Hop[] {
  // Modèle classique (Rager d'origine) : seuls les ajouts en ébullition et
  // "first wort" isomérisent de l'acide alpha de façon significative. Tinseth
  // et Garetz gèrent en plus le whirlpool (facteur de température) ;
  // dry-hop/empâtage n'isomérisent quasiment rien.
  return hops.filter((h) => h.use === 'boil' || h.use === 'first-wort')
}

/**
 * Facteur d'utilisation de l'isomérisation à une température donnée (hopstand
 * / whirlpool, en dessous du point d'ébullition), selon la loi d'Arrhenius :
 * f_T = 2,39·10¹¹ × e^(−9773 / T) (specs §4), égal à 1 à 100 °C.
 * Source : Mark Malowicki, thèse sur la cinétique d'isomérisation des acides
 * alpha ; formule reprise par Brewfather (vérifiée à ≈0,23 pour 80°C).
 */
export function hopstandUtilizationFactor(temperatureC: number): number {
  // Constante des specs (arrondie : la formule brute donne 1,009 à 100 °C), plafonnée à 1.
  return Math.min(1, ARRHENIUS_FACTOR * Math.exp(-9773 / (temperatureC + 273.15)))
}

/** Facteur pré-exponentiel de la loi d'Arrhenius du whirlpool (specs §4). */
const ARRHENIUS_FACTOR = 2.39e11

/** Facteur appliqué aux houblons « premier moût » (first wort hopping), convention courante (specs §4). */
export const FIRST_WORT_HOP_FACTOR = 1.1

/** Température par défaut d'un whirlpool / hopstand, en °C. */
export const DEFAULT_WHIRLPOOL_TEMP_C = 80

/**
 * Les pellets (houblon broyé) libèrent leurs acides alpha plus vite que les cônes :
 * +10 % d'utilisation, convention de Brewfather et BeerSmith (vérifiée sur des recettes Brewfather).
 */
export const PELLET_UTILIZATION_FACTOR = 1.1

export interface Hopstand {
  minutes: number
  temperatureC: number
}

/**
 * Hopstand de la recette déduit de ses whirlpools : la plus longue infusion, à la
 * température moyenne pondérée par la quantité de houblon. Null sans whirlpool.
 */
export function hopstandOf(hops: Hop[], defaultTempC = DEFAULT_WHIRLPOOL_TEMP_C): Hopstand | null {
  const whirlpools = hops.filter((h) => h.use === 'whirlpool' && h.timeMin > 0)
  if (whirlpools.length === 0) return null
  const totalG = whirlpools.reduce((sum, h) => sum + h.amountG, 0)
  const temperatureC =
    totalG > 0
      ? whirlpools.reduce((sum, h) => sum + (h.temperatureC ?? defaultTempC) * h.amountG, 0) / totalG
      : defaultTempC
  return { minutes: Math.max(...whirlpools.map((h) => h.timeMin)), temperatureC }
}

export interface TinsethOptions {
  /** Durée d'ébullition : temps de contact des houblons « premier moût ». Absente : leur propre `timeMin`. */
  boilTimeMin?: number
  /** Facteur correcteur de l'équipement pour les ajouts en ébullition, en % (100 par défaut). */
  hopUtilizationPercent?: number
  /** Température des whirlpools sans température propre (`Hop.temperatureC`), en °C. */
  hopstandTempC?: number
  /** Hopstand après ébullition. Absent : déduit des whirlpools de la recette (`hopstandOf`). */
  hopstand?: Hopstand | null
}

/**
 * IBU de chaque ajout selon Tinseth (specs §4), dans l'ordre de `hops` :
 * U(t) = 1,65 × 0,000125^(G − 1) × (1 − e^(−0,04 t)) / 4,15 ;
 * IBU = U(t) × f × α × g × 1000 / V. Le facteur f vaut l'utilisation de
 * l'équipement en ébullition, 1,10 en premier moût (t = durée d'ébullition),
 * le facteur de température (Arrhenius) en whirlpool, 0 en dry hop / empâtage ;
 * × 1,10 pour les pellets.
 * Les houblons d'ébullition continuent d'isomériser pendant le hopstand : la part
 * d'acide alpha restante, e^(−0,04 t), s'isomérise comme un whirlpool de même durée
 * et température (modèle de Brewfather, retrouvé sur des recettes réelles).
 * Source : Glenn Tinseth, "Hop Utilization, the Boil, and Malt Vigor".
 */
export function tinsethContributions(
  hops: Hop[],
  boilGravity: number,
  volumeL: number,
  options: TinsethOptions = {},
): number[] {
  const bignessFactor = 1.65 * 0.000125 ** (boilGravity - 1)
  const utilization = (timeMin: number) => (bignessFactor * (1 - Math.exp(-0.04 * timeMin))) / 4.15
  const hopstand = options.hopstand !== undefined ? options.hopstand : hopstandOf(hops, options.hopstandTempC)
  // Isomérisation supplémentaire pendant le hopstand, pour l'acide alpha pas encore isomérisé.
  const hopstandUtilization = (timeMin: number) =>
    hopstand
      ? hopstandUtilizationFactor(hopstand.temperatureC) * utilization(hopstand.minutes) * Math.exp(-0.04 * timeMin)
      : 0

  return hops.map((hop) => {
    let hopUtilization: number
    switch (hop.use) {
      case 'boil':
        hopUtilization =
          (utilization(hop.timeMin) + hopstandUtilization(hop.timeMin)) * ((options.hopUtilizationPercent ?? 100) / 100)
        break
      case 'first-wort': {
        const timeMin = options.boilTimeMin ?? hop.timeMin
        hopUtilization = (utilization(timeMin) + hopstandUtilization(timeMin)) * FIRST_WORT_HOP_FACTOR
        break
      }
      case 'whirlpool':
        hopUtilization =
          utilization(hop.timeMin) *
          hopstandUtilizationFactor(hop.temperatureC ?? options.hopstandTempC ?? DEFAULT_WHIRLPOOL_TEMP_C)
        break
      default:
        return 0
    }
    const formFactor = hop.form === 'pellet' ? PELLET_UTILIZATION_FACTOR : 1
    return (hopUtilization * formFactor * (hop.alphaAcidPercent / 100) * hop.amountG * 1000) / volumeL
  })
}

/** IBU total selon Tinseth : somme des ajouts (voir `tinsethContributions`). */
export function calculateIBU_Tinseth(
  hops: Hop[],
  boilGravity: number,
  volumeL: number,
  options: TinsethOptions = {},
): number {
  return tinsethContributions(hops, boilGravity, volumeL, options).reduce((sum, ibu) => sum + ibu, 0)
}

/**
 * IBU — formule de Rager.
 * Source : Jackie Rager, Zymurgy (1990). La table d'utilisation par palier de
 * temps d'origine est ici approximée par une régression "tanh" moderne
 * (reconstruction communautaire, pas la méthode publiée telle quelle).
 * Constante 7462 (imperial) convertie en 996 pour la formule métrique
 * (W_g/V_L), par le même facteur de conversion que Tinseth (7489 -> 1000).
 */
export function calculateIBU_Rager(
  hops: Hop[],
  boilGravity: number,
  batchVolumeL: number,
): number {
  const gravityAdjustment = boilGravity < 1.05 ? 0 : (boilGravity - 1.05) / 0.2

  return contributingHops(hops).reduce((total, hop) => {
    const utilizationPercent = 18.109 + 13.862 * Math.tanh((hop.timeMin - 31.323) / 18.268)
    const aaDecimal = hop.alphaAcidPercent / 100
    const ibu =
      (hop.amountG * (utilizationPercent / 100) * aaDecimal * 996) /
      (batchVolumeL * (1 + gravityAdjustment))
    return total + ibu
  }, 0)
}

/**
 * Table d'utilisation de Garetz, en % d'acide alpha isomérisé selon la durée
 * d'ébullition : chaque palier [borne haute en min, %] couvre les durées
 * jusqu'à sa borne incluse (0–5 min : 0 %, 6–10 min : 0 %, 11–15 min : 2 %…).
 * Au-delà de 90 min, l'utilisation plafonne à 23 %.
 * Source : Mark Garetz, Using Hops (1994), table reproduite par Michael L. Hall,
 * « Brew by the Numbers », Zymurgy (1995) — valeurs non revérifiées sur
 * l'ouvrage original. Garetz donne peu d'amertume aux ajouts courts (moins de
 * 10 min ne compte pas du tout), d'où des IBU en général plus bas que Tinseth.
 */
export const GARETZ_UTILIZATION_TABLE: ReadonlyArray<readonly [maxMin: number, percent: number]> = [
  [5, 0],
  [10, 0],
  [15, 2],
  [20, 5],
  [25, 8],
  [30, 11],
  [35, 14],
  [40, 16],
  [45, 18],
  [50, 19],
  [60, 20],
  [70, 21],
  [80, 22],
  [90, 23],
]

/** Utilisation de base de Garetz (fraction, pas %) pour une durée d'ébullition en minutes. */
export function garetzUtilization(timeMin: number): number {
  // Champ en cours de saisie : comme Tinseth, on propage NaN plutôt que de choisir un palier.
  if (Number.isNaN(timeMin)) return Number.NaN
  const step = GARETZ_UTILIZATION_TABLE.find(([maxMin]) => timeMin <= maxMin)
  const percent = step ? step[1] : GARETZ_UTILIZATION_TABLE[GARETZ_UTILIZATION_TABLE.length - 1][1]
  return percent / 100
}

/** Garetz : +2 % de correction par tranche de 550 pieds d'altitude (ébullition plus froide), ici en mètres. */
const GARETZ_ALTITUDE_STEP_M = 550 * M_PER_FT

export interface GaretzOptions {
  /** Durée d'ébullition : temps de contact des houblons « premier moût ». Absente : leur propre `timeMin`. */
  boilTimeMin?: number
  /** Facteur correcteur de l'équipement pour les ajouts en ébullition, en % (100 par défaut). */
  hopUtilizationPercent?: number
  /** Température des whirlpools sans température propre (`Hop.temperatureC`), en °C. */
  hopstandTempC?: number
  /**
   * Volume d'ébullition (L), pour le facteur de concentration CF = volume final / volume
   * d'ébullition. Absent (ou ≤ 0) : égal au volume final, CF = 1.
   */
  boilVolumeL?: number
  /** Altitude du lieu de brassage, en mètres. 0 par défaut : TF = 1. */
  altitudeM?: number
  /**
   * IBU visés, pour le facteur d'amertume HF comme dans le livre (le brasseur y saisit
   * sa cible). Absents : HF est calculé sur les IBU obtenus eux-mêmes (point fixe).
   */
  desiredIbu?: number
}

/**
 * IBU de chaque ajout selon Garetz, dans l'ordre de `hops`.
 *
 * IBU = U(t) × f × α × g × 1000 / (V × CA), mêmes unités que Tinseth (g, L, α en %
 * ramené en fraction ; 1000 est l'équivalent métrique du 0,749 de la formule
 * impériale, où U et α sont en %). U(t) vient de la table de Garetz
 * (`GARETZ_UTILIZATION_TABLE`), V est le volume final (fin d'ébullition) et le
 * facteur combiné CA = GF × HF × TF :
 * - CF (concentration) = volume final / volume d'ébullition ;
 * - GF (gravité) = (densité d'ébullition − 1,050) / 0,2 + 1, ramené à 1 en dessous de
 *   1,050 (pas de bonus d'amertume pour un moût léger, comme Rager). La densité
 *   d'ébullition est celle fournie par l'appelant (moyenne pré-ébullition / fin
 *   d'ébullition dans `computeRecipe`) et non recalculée depuis la DI × CF comme
 *   dans le livre, par cohérence avec Tinseth et Rager ;
 * - HF (taux de houblonnage) = CF × IBU / 260 + 1 : plus on houblonne, moins
 *   l'acide alpha se dissout. HF dépend des IBU qu'il sert à calculer : le livre
 *   part des IBU visés et itère. Sans cible, on prend le point fixe de cette
 *   itération, I × (1 + CF × I / 260) = R (R = total avant HF), résolu exactement
 *   par I = 2R / (1 + √(1 + 4 × CF × R / 260)) ;
 * - TF (température / altitude) = altitude en pieds / 550 × 0,02 + 1, donc 1 par défaut.
 *
 * Le facteur f suit les conventions de Tinseth dans l'appli : utilisation de
 * l'équipement en ébullition, × 1,10 en premier moût (t = durée d'ébullition), facteur
 * de température (Arrhenius) en whirlpool, 0 en dry hop / empâtage ; × 1,10 pour les
 * pellets. Pas de prolongation de l'isomérisation des ajouts en ébullition pendant le
 * hopstand : c'est le modèle cinétique (exponentiel) de Tinseth, sans équivalent dans
 * une table par paliers.
 * HF étant commun à tous les ajouts, chaque houblon reçoit sa part au prorata.
 */
export function garetzContributions(
  hops: Hop[],
  boilGravity: number,
  finalVolumeL: number,
  options: GaretzOptions = {},
): number[] {
  const concentrationFactor =
    options.boilVolumeL !== undefined && options.boilVolumeL > 0 ? finalVolumeL / options.boilVolumeL : 1
  const gravityFactor = Math.max(1, (boilGravity - 1.05) / 0.2 + 1)
  const temperatureFactor = ((options.altitudeM ?? 0) / GARETZ_ALTITUDE_STEP_M) * 0.02 + 1

  // IBU de chaque ajout avant les facteurs de correction (CA = 1).
  const raw = hops.map((hop) => {
    let hopUtilization: number
    switch (hop.use) {
      case 'boil':
        hopUtilization = garetzUtilization(hop.timeMin) * ((options.hopUtilizationPercent ?? 100) / 100)
        break
      case 'first-wort':
        hopUtilization = garetzUtilization(options.boilTimeMin ?? hop.timeMin) * FIRST_WORT_HOP_FACTOR
        break
      case 'whirlpool':
        hopUtilization =
          garetzUtilization(hop.timeMin) *
          hopstandUtilizationFactor(hop.temperatureC ?? options.hopstandTempC ?? DEFAULT_WHIRLPOOL_TEMP_C)
        break
      default:
        return 0
    }
    const formFactor = hop.form === 'pellet' ? PELLET_UTILIZATION_FACTOR : 1
    return (hopUtilization * formFactor * (hop.alphaAcidPercent / 100) * hop.amountG * 1000) / finalVolumeL
  })

  // Total corrigé de GF et TF, avant le facteur d'amertume.
  const beforeHoppingRate = raw.reduce((sum, ibu) => sum + ibu, 0) / (gravityFactor * temperatureFactor)
  const referenceIbu =
    options.desiredIbu ??
    (2 * beforeHoppingRate) / (1 + Math.sqrt(1 + (4 * concentrationFactor * beforeHoppingRate) / 260))
  const hoppingRateFactor = (concentrationFactor * referenceIbu) / 260 + 1
  const combinedAdjustment = gravityFactor * hoppingRateFactor * temperatureFactor

  return raw.map((ibu) => ibu / combinedAdjustment)
}

/** IBU total selon Garetz : somme des ajouts (voir `garetzContributions`). */
export function calculateIBU_Garetz(
  hops: Hop[],
  boilGravity: number,
  finalVolumeL: number,
  options: GaretzOptions = {},
): number {
  return garetzContributions(hops, boilGravity, finalVolumeL, options).reduce((sum, ibu) => sum + ibu, 0)
}
