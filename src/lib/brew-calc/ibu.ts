import type { Hop } from './types'
import { gToOz, litersToGallons } from './units'

function contributingHops(hops: Hop[]): Hop[] {
  // Modèle classique (Tinseth/Rager/Garetz d'origine) : seuls les ajouts en
  // ébullition et "first wort" isomérisent de l'acide alpha de façon
  // significative. Le whirlpool est géré séparément par calculateIBU_Tinseth
  // (facteur de température) ; dry-hop/empâtage n'isomérisent quasiment rien.
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

export interface GaretzParams {
  boilGravity: number
  preBoilVolumeL: number
  finalVolumeL: number
  batchVolumeL: number
  /** Altitude du lieu de brassage, en pieds (0 = niveau de la mer). */
  altitudeFt?: number
  /**
   * IBU visés de la recette, utilisés pour le "Hopping Rate Factor".
   * Le calcul de Garetz est circulaire par construction (HF dépend de l'IBU
   * visé) ; si non fourni, HF est neutralisé (= 1), ce qui dégrade la
   * précision de cette formule déjà la moins solidement sourcée des trois.
   */
  desiredIBU?: number
}

/**
 * IBU — formule de Garetz.
 * Source : Mark Garetz, Using Hops (1994). Implémentation la moins fiable
 * des trois (constantes non vérifiées contre l'ouvrage original) — à traiter
 * comme un calcul "best effort".
 */
export function calculateIBU_Garetz(hops: Hop[], params: GaretzParams): number {
  const { boilGravity, preBoilVolumeL, finalVolumeL, batchVolumeL, altitudeFt = 0, desiredIBU } =
    params

  const concentrationFactor = finalVolumeL / preBoilVolumeL
  const boilGravityAdjusted = concentrationFactor * (boilGravity - 1) + 1
  const gravityFactor = (boilGravityAdjusted - 1.05) / 0.2 + 1
  const hoppingRateFactor =
    desiredIBU !== undefined ? (concentrationFactor * desiredIBU) / 260 + 1 : 1
  const temperatureAltitudeFactor = (altitudeFt / 550) * 0.02 + 1
  const combinedAdjustment = gravityFactor * hoppingRateFactor * temperatureAltitudeFactor

  const volumeGal = litersToGallons(batchVolumeL)

  return contributingHops(hops).reduce((total, hop) => {
    const utilizationPercent = 7.2994 + 15.0746 * Math.tanh((hop.timeMin - 21.86) / 24.71)
    const aaDecimal = hop.alphaAcidPercent / 100
    const weightOz = gToOz(hop.amountG)
    const ibu =
      ((utilizationPercent / 100) * aaDecimal * weightOz * 0.749) / (volumeGal * combinedAdjustment)
    return total + ibu
  }, 0)
}
