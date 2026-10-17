import { computeRecipe, REFERENCE_MASH_TEMP_C, type RecipeCalculation } from '@/lib/brew-calc/recipe-stats'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import type { ParsedRecipeDraft } from '@/lib/beerxml/types'
import { brewfatherEquipmentToProfile, brewfatherRecipeToDraft } from './mapping'
import type { BrewfatherRecipe } from './types'

export type ComparisonKey = 'og' | 'fg' | 'ibu' | 'srm' | 'abv' | 'preBoilVolume'

export interface ComparisonRow {
  key: ComparisonKey
  label: string
  brewfather: number
  ours: number
  /** Écart nous − Brewfather. */
  diff: number
  /** Écart jugé négligeable (arrondis, petites différences de formule). */
  ok: boolean
  decimals: number
  unit?: string
}

export interface BrewfatherComparison {
  draft: ParsedRecipeDraft
  equipment: EquipmentProfile | null
  calc: RecipeCalculation
  rows: ComparisonRow[]
}

/** Écarts tolérés : de l'ordre de l'arrondi affiché par les deux logiciels. */
const TOLERANCES: Record<ComparisonKey, number> = {
  og: 0.002,
  fg: 0.002,
  ibu: 2,
  srm: 1,
  abv: 0.2,
  preBoilVolume: 0.5,
}

/**
 * Recalcule une recette Brewfather avec notre moteur et son propre profil d'équipement,
 * puis met nos valeurs en regard de celles annoncées par Brewfather.
 * La DF est calculée sans l'ajustement par la température d'empâtage (que Brewfather
 * n'applique pas), pour comparer les formules à hypothèses égales.
 */
export function compareWithBrewfather(recipe: BrewfatherRecipe): BrewfatherComparison {
  const draft = brewfatherRecipeToDraft(recipe)
  const equipment = brewfatherEquipmentToProfile(recipe)
  const calc = computeRecipe({ ...draft, mashTempC: REFERENCE_MASH_TEMP_C, ibuFormula: 'tinseth', equipment })

  const rows: ComparisonRow[] = []
  const add = (key: ComparisonKey, label: string, brewfather: number | undefined, ours: number | null | undefined, decimals: number, unit?: string) => {
    if (brewfather === undefined || brewfather === null || ours === undefined || ours === null) return
    const diff = ours - brewfather
    rows.push({ key, label, brewfather, ours, diff, ok: Math.abs(diff) <= TOLERANCES[key], decimals, unit })
  }
  add('og', 'DI', recipe.og, calc.og, 3)
  add('fg', 'DF', recipe.fg, calc.fg, 3)
  add('abv', 'Alcool', recipe.abv, calc.abv, 1, '%')
  add('ibu', 'Amertume', recipe.ibu, calc.ibu, 0, 'IBU')
  add('srm', 'Couleur', recipe.color, calc.srm, 1, 'SRM')
  add('preBoilVolume', 'Volume pré-ébullition', recipe.boilSize, calc.volumes?.preBoilVolumeL, 1, 'L')

  return { draft, equipment, calc, rows }
}
