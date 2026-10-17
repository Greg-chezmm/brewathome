import { describe, expect, it } from 'vitest'
import { calculateIBU_Rager, calculateIBU_Tinseth } from '@/lib/brew-calc/ibu'
import { estimateRecipeStats, type RecipeStatsInput } from '@/lib/brew-calc/recipe-stats'

const base: RecipeStatsInput = {
  fermentables: [{ name: 'Pale Ale', type: 'grain', amountKg: 5, colorLovibond: 3, yieldPercent: 80 }],
  hops: [{ name: 'Magnum', amountG: 30, alphaAcidPercent: 12, timeMin: 60, use: 'boil' }],
  yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 80 }],
  targetVolumeL: 20,
  mashEfficiencyPercent: 72,
  ibuFormula: 'tinseth',
}

describe('estimateRecipeStats', () => {
  it('uses Tinseth when the recipe asks for it', () => {
    const stats = estimateRecipeStats(base)
    expect(stats.ibu).toBeCloseTo(calculateIBU_Tinseth(base.hops, stats.og, base.targetVolumeL), 10)
  })

  it('uses Rager when the recipe asks for it', () => {
    const stats = estimateRecipeStats({ ...base, ibuFormula: 'rager' })
    expect(stats.ibu).toBeCloseTo(calculateIBU_Rager(base.hops, stats.og, base.targetVolumeL), 10)
    expect(stats.ibu).not.toBeCloseTo(estimateRecipeStats(base).ibu, 1)
  })

  it('falls back to 75 % attenuation without yeast', () => {
    const stats = estimateRecipeStats({ ...base, yeasts: [] })
    expect((stats.og - stats.fg) / (stats.og - 1)).toBeCloseTo(0.75, 5)
  })

  it('derives ABV from the estimated OG/FG', () => {
    const stats = estimateRecipeStats(base)
    expect(stats.og).toBeGreaterThan(stats.fg)
    expect(stats.abv).toBeGreaterThan(0)
  })
})
