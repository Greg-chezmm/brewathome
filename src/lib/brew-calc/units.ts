// Constantes et conversions d'unités (métrique <-> impérial) partagées par
// tous les modules de brew-calc, pour n'avoir qu'une seule source de vérité
// sur les facteurs de conversion utilisés dans les formules brassicoles.

export const KG_PER_LB = 0.45359237
export const LB_PER_KG = 1 / KG_PER_LB
export const L_PER_GAL = 3.785411784
export const GAL_PER_L = 1 / L_PER_GAL
export const G_PER_OZ = 28.349523125
export const OZ_PER_G = 1 / G_PER_OZ

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

export function litersToGallons(liters: number): number {
  return liters * GAL_PER_L
}

export function gallonsToLiters(gallons: number): number {
  return gallons * L_PER_GAL
}

export function gToOz(g: number): number {
  return g * OZ_PER_G
}

export function ozToG(oz: number): number {
  return oz * G_PER_OZ
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9
}

/** Conversion SRM -> EBC (couleur de la bière). */
export function srmToEbc(srm: number): number {
  return srm * 1.97
}

/** Conversion EBC -> SRM (couleur de la bière). */
export function ebcToSrm(ebc: number): number {
  return ebc * 0.508
}

export type UnitSystem = 'metric' | 'imperial'
