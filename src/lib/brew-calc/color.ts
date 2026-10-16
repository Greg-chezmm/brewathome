import type { Fermentable } from './types'
import { kgToLb, litersToGallons } from './units'

/**
 * Couleur SRM — formule de Morey.
 * Source : Dan Morey. MCU = (poids_lb x Lovibond) / vol_gal ; SRM = 1.4922 x MCU^0.6859.
 */
export function calculateSRM(fermentables: Fermentable[], volumeL: number): number {
  const volumeGal = litersToGallons(volumeL)
  const mcu =
    fermentables.reduce((total, f) => total + kgToLb(f.amountKg) * f.colorLovibond, 0) / volumeGal
  return 1.4922 * mcu ** 0.6859
}

/**
 * Approximation SRM -> couleur sRGB utilisée par de nombreux calculateurs de
 * brassage (ex. BeerSmith, Brewer's Friend) pour l'aperçu visuel de la
 * couleur de bière. Ce n'est pas une conversion colorimétrique exacte (le SRM
 * est défini par absorbance à 430nm, pas en sRGB), mais elle donne un rendu
 * visuellement fidèle sur toute la plage usuelle (0-40 SRM).
 */
export function srmToCssColor(srm: number): string {
  const clamped = Math.max(0, srm)
  const r = Math.round(255 * 0.975 ** clamped)
  const g = Math.round(249 * 0.88 ** clamped)
  const b = Math.round(215 * 0.7 ** clamped)
  return `rgb(${r}, ${g}, ${b})`
}
