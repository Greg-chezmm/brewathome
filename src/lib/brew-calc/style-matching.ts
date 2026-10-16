import type { BJCPStyleRanges, RecipeStats, StyleRange } from './types'

export interface StyleMatchResult {
  og: boolean
  fg: boolean
  ibu: boolean
  srm: boolean
  abv: boolean
  allMatch: boolean
}

function inRange(value: number, range: StyleRange): boolean {
  return value >= range.min && value <= range.max
}

/**
 * Compare les statistiques d'une recette aux plages d'un style BJCP.
 * Logique de plage (conforme/hors plage) comme Brewfather/BeerSmith — pas de
 * score en pourcentage.
 */
export function matchStyle(stats: RecipeStats, style: BJCPStyleRanges): StyleMatchResult {
  const result = {
    og: inRange(stats.og, style.og),
    fg: inRange(stats.fg, style.fg),
    ibu: inRange(stats.ibu, style.ibu),
    srm: inRange(stats.srm, style.srm),
    abv: inRange(stats.abv, style.abv),
  }
  return { ...result, allMatch: Object.values(result).every(Boolean) }
}
