import { describe, expect, it } from 'vitest'
import recipes from '../fixtures/brewfather/recent-recipes.json'
import { compareWithBrewfather } from '@/lib/brewfather/compare'
import type { BrewfatherRecipe } from '@/lib/brewfather/types'

/**
 * Recettes Brewfather réelles (les 5 plus récentes du compte, réduites aux ingrédients
 * et aux valeurs calculées par Brewfather) : notre moteur doit retrouver ses chiffres.
 * Écart assumé : l'IBU des bières fortes, car Brewfather calcule l'amertume sur la
 * densité pré-ébullition et nous (specs §4) sur la moyenne pré-ébullition / DI.
 */
const STRONG_BEER_OG = 1.07

describe.each(recipes as BrewfatherRecipe[])('recette Brewfather « $name »', (recipe) => {
  const { rows } = compareWithBrewfather(recipe)
  const row = (key: string) => rows.find((r) => r.key === key)!

  it.each(['og', 'srm', 'preBoilVolume', 'fg', 'abv'])('%s concorde', (key) => {
    // La DF estimée par Brewfather suit un modèle qui lui est propre (sucre, densité) et ne
    // découle pas toujours de l'atténuation qu'il affiche : on ne compare DF et alcool que
    // lorsque son estimation correspond à DI × (1 − atténuation), à hypothèses égales.
    const og = recipe.og ?? 1
    const fgFromAttenuation = 1 + (og - 1) * (1 - (recipe.attenuation ?? 0))
    const consistent = Math.abs(fgFromAttenuation - (recipe.fgEstimated ?? recipe.fg ?? 0)) < 0.001
    if ((key === 'fg' || key === 'abv') && !consistent) return
    expect(row(key).ok, `${row(key).label} : ${row(key).ours} contre ${row(key).brewfather}`).toBe(true)
  })

  it('IBU concorde (hors bières fortes)', () => {
    if ((recipe.og ?? 0) >= STRONG_BEER_OG) return
    expect(row('ibu').ok, `IBU : ${row('ibu').ours} contre ${row('ibu').brewfather}`).toBe(true)
  })
})
