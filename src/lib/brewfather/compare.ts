import { calculateABV_simple } from '@/lib/brew-calc/abv'
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
 * Pour la DF, on reprend l'atténuation retenue par Brewfather : il l'ajuste selon l'empâtage
 * et la part de sucres/malts caramel avec un modèle qui lui est propre. On compare ainsi
 * la formule DI → DF → ABV à hypothèses égales (notre ajustement par la température
 * d'empâtage est neutralisé).
 */
export function compareWithBrewfather(recipe: BrewfatherRecipe): BrewfatherComparison {
  const draft = brewfatherRecipeToDraft(recipe)
  const equipment = brewfatherEquipmentToProfile(recipe)
  const yeasts =
    recipe.attenuation !== undefined && recipe.attenuation !== null
      ? [{ ...(draft.yeasts[0] ?? { name: 'Levure', type: 'dry' as const, style: 'ale' as const }), attenuationPercent: recipe.attenuation * 100 }]
      : draft.yeasts
  const calc = computeRecipe({ ...draft, yeasts, mashTempC: REFERENCE_MASH_TEMP_C, ibuFormula: 'tinseth', equipment })

  const rows: ComparisonRow[] = []
  const add = (key: ComparisonKey, label: string, brewfather: number | undefined, ours: number | null | undefined, decimals: number, unit?: string) => {
    if (brewfather === undefined || brewfather === null || ours === undefined || ours === null) return
    const diff = ours - brewfather
    rows.push({ key, label, brewfather, ours, diff, ok: Math.abs(diff) <= TOLERANCES[key], decimals, unit })
  }
  add('og', 'DI', recipe.og, calc.og, 3)
  // Une DF saisie à la main remplace l'estimation dans « fg » (et l'alcool en découle) :
  // on compare alors à l'estimation, et à l'alcool qu'elle donnerait.
  const fgEstimated = recipe.fgEstimated ?? recipe.fg
  const manualFg = recipe.fg !== undefined && fgEstimated !== undefined && Math.abs(recipe.fg - fgEstimated) > 0.0005
  const abv = manualFg && recipe.og !== undefined && fgEstimated !== undefined ? calculateABV_simple(recipe.og, fgEstimated) : recipe.abv
  add('fg', 'DF', fgEstimated, calc.fg, 3)
  add('abv', 'Alcool', abv, calc.abv, 1, '%')
  add('ibu', 'Amertume', recipe.ibu, calc.ibu, 0, 'IBU')
  add('srm', 'Couleur', recipe.color, calc.srm, 1, 'SRM')
  add('preBoilVolume', 'Volume pré-ébullition', recipe.boilSize, calc.volumes?.preBoilVolumeL, 1, 'L')

  return { draft, equipment, calc, rows }
}
