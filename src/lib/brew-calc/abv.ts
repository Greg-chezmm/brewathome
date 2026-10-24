/** ABV — formule simple, fiable jusqu'à environ OG 1.070 / ABV 6-7%. */
export function calculateABV_simple(og: number, fg: number): number {
  return (og - fg) * 131.25
}
