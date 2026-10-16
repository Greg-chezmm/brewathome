/** ABV — formule simple, fiable jusqu'à environ OG 1.070 / ABV 6-7%. */
export function calculateABV_simple(og: number, fg: number): number {
  return (og - fg) * 131.25
}

/**
 * ABV — formule précise attribuée à Michael L. Hall (Zymurgy, 1995).
 * Plus fiable que la formule simple au-delà de OG 1.070 (bières fortes).
 */
export function calculateABV_Hall(og: number, fg: number): number {
  return ((76.08 * (og - fg)) / (1.775 - og)) * (fg / 0.794)
}

/** Bascule automatiquement vers la formule de Hall au-delà de OG 1.070. */
export function calculateABV(og: number, fg: number): number {
  return og > 1.07 ? calculateABV_Hall(og, fg) : calculateABV_simple(og, fg)
}
