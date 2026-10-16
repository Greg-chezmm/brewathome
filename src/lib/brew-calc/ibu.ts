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
 * / whirlpool, en dessous du point d'ébullition), selon la loi d'Arrhenius.
 * Source : Mark Malowicki, thèse sur la cinétique d'isomérisation des acides
 * alpha ; formule reprise par Brewfather (vérifiée à ≈0,23 pour 80°C).
 */
export function hopstandUtilizationFactor(temperatureC: number): number {
  const tempK = temperatureC + 273.15
  const boilTempK = 100 + 273.15
  return Math.exp(-9773 * (1 / tempK - 1 / boilTempK))
}

/**
 * IBU — formule de Tinseth.
 * Source : Glenn Tinseth, "Hop Utilization, the Boil, and Malt Vigor".
 * Les ajouts whirlpool/hopstand sont inclus via le facteur de température de
 * Malowicki (cf. hopstandUtilizationFactor) — approximation documentée, un
 * écart résiduel avec Brewfather subsiste sur ce point précis (non élucidé).
 */
export function calculateIBU_Tinseth(
  hops: Hop[],
  boilGravity: number,
  batchVolumeL: number,
  hopstandTempC = 80,
): number {
  const bignessFactor = 1.65 * 0.000125 ** (boilGravity - 1)

  const boilIbu = contributingHops(hops).reduce((total, hop) => {
    const boilTimeFactor = (1 - Math.exp(-0.04 * hop.timeMin)) / 4.15
    const utilization = bignessFactor * boilTimeFactor
    const aaDecimal = hop.alphaAcidPercent / 100
    const ibu = (hop.amountG * aaDecimal * utilization * 1000) / batchVolumeL
    return total + ibu
  }, 0)

  const whirlpoolIbu = hops
    .filter((h) => h.use === 'whirlpool')
    .reduce((total, hop) => {
      const boilTimeFactor = (1 - Math.exp(-0.04 * hop.timeMin)) / 4.15
      const utilization = bignessFactor * boilTimeFactor * hopstandUtilizationFactor(hopstandTempC)
      const aaDecimal = hop.alphaAcidPercent / 100
      const ibu = (hop.amountG * aaDecimal * utilization * 1000) / batchVolumeL
      return total + ibu
    }, 0)

  return boilIbu + whirlpoolIbu
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
