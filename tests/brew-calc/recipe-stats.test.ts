import { describe, expect, it } from 'vitest'
import { calculateIBU_Garetz, calculateIBU_Rager, calculateIBU_Tinseth } from '@/lib/brew-calc/ibu'
import {
  adjustAttenuationForMashTemp,
  computeRecipe,
  estimateRecipeStats,
  REFERENCE_MASH_TEMP_C,
  type RecipeStatsInput,
} from '@/lib/brew-calc/recipe-stats'

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

  it('utilise Garetz quand la recette le demande, avec le détail par houblon', () => {
    const input: RecipeStatsInput = {
      ...base,
      ibuFormula: 'garetz',
      hops: [...base.hops, { name: 'Cascade', amountG: 20, alphaAcidPercent: 6, timeMin: 15, use: 'boil' }],
    }
    const calc = computeRecipe(input)
    // Sans équipement : volume d'ébullition inconnu, CF = 1.
    expect(calc.ibu).toBeCloseTo(calculateIBU_Garetz(input.hops, calc.og, base.targetVolumeL), 10)
    expect(calc.ibuByHop).toHaveLength(2)
    expect(calc.ibuByHop[0] + calc.ibuByHop[1]).toBeCloseTo(calc.ibu, 10)
    expect(calc.ibu).toBeLessThan(computeRecipe({ ...input, ibuFormula: 'tinseth' }).ibu)
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

describe('adjustAttenuationForMashTemp', () => {
  it('leaves the yeast attenuation untouched at the reference temperature', () => {
    expect(adjustAttenuationForMashTemp(78, REFERENCE_MASH_TEMP_C)).toBe(78)
  })

  it('lowers attenuation when mashing hotter and raises it when mashing cooler', () => {
    expect(adjustAttenuationForMashTemp(78, 69)).toBe(76)
    expect(adjustAttenuationForMashTemp(78, 64)).toBe(81)
  })

  it('stops adjusting outside the 62–72 °C range', () => {
    expect(adjustAttenuationForMashTemp(78, 80)).toBe(adjustAttenuationForMashTemp(78, 72))
    expect(adjustAttenuationForMashTemp(78, 50)).toBe(adjustAttenuationForMashTemp(78, 62))
  })
})

describe('estimateRecipeStats — mash temperature', () => {
  it('gives a higher FG and lower ABV for a hotter mash, same OG', () => {
    const cool = estimateRecipeStats({ ...base, mashTempC: 64 })
    const hot = estimateRecipeStats({ ...base, mashTempC: 70 })
    expect(hot.og).toBe(cool.og)
    expect(hot.fg).toBeGreaterThan(cool.fg)
    expect(hot.abv).toBeLessThan(cool.abv)
  })

  it('is unchanged when no mash temperature is given', () => {
    expect(estimateRecipeStats(base)).toEqual(estimateRecipeStats({ ...base, mashTempC: REFERENCE_MASH_TEMP_C }))
  })
})
