import { computeRecipe, type RecipeStatsInput } from './recipe-stats'
import type { Fermentable, Hop } from './types'

/** Arrondi des quantités proposées : 10 g de grain (2 décimales en kg), 1 g de houblon. */
const FERMENTABLE_DECIMALS = 2
const HOP_DECIMALS = 0

/**
 * Met tous les fermentables à l'échelle pour viser une DI, en gardant les proportions
 * du grain (donc le caractère de la recette). La DI est proportionnelle aux quantités
 * à volume de calcul constant ; on recalcule une seconde fois pour absorber l'effet
 * du grain sur les volumes, puis on arrondit à 10 g.
 * Renvoie null si la recette n'a encore aucun sucre extractible.
 */
export function scaleFermentablesToOg(input: RecipeStatsInput, targetOg: number): Fermentable[] | null {
  if (!(targetOg > 1)) return null
  let fermentables = input.fermentables.map((f) => ({ ...f, amountKg: safe(f.amountKg) }))
  for (let pass = 0; pass < 2; pass++) {
    const og = computeRecipe({ ...input, fermentables }).og
    if (!(og > 1)) return null
    const factor = (targetOg - 1) / (og - 1)
    fermentables = fermentables.map((f) => ({ ...f, amountKg: f.amountKg * factor }))
  }
  return fermentables.map((f) => ({ ...f, amountKg: round(f.amountKg, FERMENTABLE_DECIMALS) }))
}

/**
 * Houblon à ajuster pour viser un IBU : l'ajout amérisant, c'est-à-dire le plus long
 * en ébullition (premier moût compris). Les houblons d'arôme gardent leur dose.
 */
export function bitteringHopIndex(hops: Hop[]): number | null {
  let best: number | null = null
  hops.forEach((hop, i) => {
    if (hop.use !== 'boil' && hop.use !== 'first-wort') return
    const current = best === null ? null : hops[best]
    const longer =
      current === null ||
      (hop.use === 'first-wort' && current.use !== 'first-wort') ||
      (hop.use === current.use && safe(hop.timeMin) > safe(current.timeMin))
    if (longer) best = i
  })
  return best
}

export interface HopTargetResult {
  hops: Hop[]
  /** Quantité retenue pour le houblon ajusté (g). */
  amountG: number
  /** Les autres houblons dépassent déjà la cible à eux seuls : le houblon ajusté tombe à 0 g. */
  unreachable: boolean
}

/** Nombre maximal de pas de sécante pour viser un IBU (Garetz converge en 3 ou 4). */
const MAX_SECANT_STEPS = 20

/**
 * Règle la quantité d'un houblon pour viser un IBU, les autres restant tels quels.
 * L'IBU d'un houblon est proportionnel à sa quantité en Tinseth et Rager, à densité
 * d'ébullition donnée : deux calculs donnent la pente, le premier pas tombe juste.
 * En Garetz, le facteur d'amertume (HF) rend l'IBU croissant mais pas proportionnel :
 * on affine par la méthode de la sécante.
 */
export function adjustHopForIbu(input: RecipeStatsInput, hopIndex: number, targetIbu: number): HopTargetResult | null {
  const hop = input.hops[hopIndex]
  if (!hop || !(targetIbu >= 0)) return null
  const withAmount = (amountG: number) =>
    input.hops.map((h, i) => ({ ...h, amountG: i === hopIndex ? amountG : safe(h.amountG) }))
  const ibuAt = (amountG: number) => computeRecipe({ ...input, hops: withAmount(amountG) }).ibu
  const ibuWithout = ibuAt(0)
  // Deux points (quantité, IBU) de la sécante.
  let x0 = 0
  let y0 = ibuWithout
  let x1 = 100
  let y1 = ibuAt(100)
  if (!(y1 - y0 > 0)) return null
  let exact = x1 + ((targetIbu - y1) * (x1 - x0)) / (y1 - y0)
  for (let step = 0; step < MAX_SECANT_STEPS && exact > 0; step++) {
    const y = ibuAt(exact)
    if (!(Math.abs(y - targetIbu) > 1e-6) || y === y1) break
    x0 = x1
    y0 = y1
    x1 = exact
    y1 = y
    exact = x1 + ((targetIbu - y1) * (x1 - x0)) / (y1 - y0)
  }
  const amountG = Math.max(0, round(exact, HOP_DECIMALS))
  return { hops: withAmount(amountG), amountG, unreachable: targetIbu < ibuWithout }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Valeur en cours de saisie (champ vidé = NaN) : comptée comme 0. */
function safe(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0
}
