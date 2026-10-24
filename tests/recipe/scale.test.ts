import { describe, expect, it } from 'vitest'
import { scaleRecipe, scaleAmountText } from '@/lib/recipe/scale'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const recipe: RecipeDetails = {
  id: 'r1',
  name: 'Brune forte',
  status: 'validated',
  estOg: 1.07,
  estFg: 1.016,
  estIbu: 30,
  estSrm: 20,
  estAbv: 7,
  createdAt: '2026-01-01',
  styleId: null,
  type: 'all-grain',
  targetVolumeL: 10,
  boilTimeMin: 60,
  mashEfficiencyPercent: 72,
  mashTempC: 66,
  mashSteps: [{ name: 'Sacchar.', tempC: 66, timeMin: 60 }],
  fermentationSteps: [{ type: 'primary', tempC: 19, days: 10 }],
  carbonationVols: 2.3,
  ibuFormula: 'tinseth',
  equipmentProfileId: 'eq-10',
  notes: 'Notes d’origine',
  fermentables: [
    { name: 'Pale', type: 'grain', amountKg: 2, colorLovibond: 3, yieldPercent: 80 },
    { name: 'Sucre candi', type: 'sugar', amountKg: 0.3, colorLovibond: 1, yieldPercent: 100, use: 'fermentation' },
  ],
  hops: [
    { name: 'Magnum', amountG: 10, alphaAcidPercent: 12, timeMin: 60, use: 'boil' },
    { name: 'Citra', amountG: 15, alphaAcidPercent: 12, timeMin: 0, use: 'dry-hop', dryHopDay: 7, dryHopDays: 4 },
  ],
  yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 80, amount: 1, amountUnit: 'pkg' }],
  otherIngredients: [{ name: 'Whirlfloc', amount: '1 tablette', timeMin: 10 }],
}

describe('scaleRecipe', () => {
  it('règle le volume cible et nomme la copie', () => {
    const scaled = scaleRecipe(recipe, 20, { name: 'Brune forte (20 L)', equipmentProfileId: 'eq-20' })
    expect(scaled.targetVolumeL).toBe(20)
    expect(scaled.name).toBe('Brune forte (20 L)')
    expect(scaled.equipmentProfileId).toBe('eq-20')
  })

  it('met à l’échelle fermentables et houblons proportionnellement', () => {
    const scaled = scaleRecipe(recipe, 20, { name: 'x', equipmentProfileId: null })
    expect(scaled.fermentables.map((f) => f.amountKg)).toEqual([4, 0.6])
    expect(scaled.hops.map((h) => h.amountG)).toEqual([20, 30])
  })

  it('garde l’amertume et la densité : l’échelle est la même pour tout', () => {
    const scaled = scaleRecipe(recipe, 5, { name: 'x', equipmentProfileId: null })
    expect(scaled.fermentables[0].amountKg).toBeCloseTo(1, 10)
    expect(scaled.hops[0].amountG).toBeCloseTo(5, 10)
  })

  it('ne touche pas aux temps, températures, paliers ni à l’efficacité', () => {
    const scaled = scaleRecipe(recipe, 20, { name: 'x', equipmentProfileId: null })
    expect(scaled.boilTimeMin).toBe(60)
    expect(scaled.mashEfficiencyPercent).toBe(72)
    expect(scaled.mashSteps).toEqual(recipe.mashSteps)
    expect(scaled.fermentationSteps).toEqual(recipe.fermentationSteps)
    expect(scaled.hops[1]).toMatchObject({ dryHopDay: 7, dryHopDays: 4, timeMin: 0 })
    expect(scaled.carbonationVols).toBe(2.3)
  })

  it('met la levure à l’échelle avec au moins un sachet', () => {
    expect(scaleRecipe(recipe, 20, { name: 'x', equipmentProfileId: null }).yeasts[0].amount).toBe(2)
    expect(scaleRecipe(recipe, 5, { name: 'x', equipmentProfileId: null }).yeasts[0].amount).toBe(1)
  })

  it('met la levure en grammes à l’échelle sans arrondir à l’entier', () => {
    const grams = { ...recipe, yeasts: [{ ...recipe.yeasts[0], amount: 5.5, amountUnit: 'g' as const }] }
    expect(scaleRecipe(grams, 20, { name: 'x', equipmentProfileId: null }).yeasts[0].amount).toBeCloseTo(11, 10)
  })

  it('laisse la levure sans quantité telle quelle', () => {
    const none = { ...recipe, yeasts: [{ ...recipe.yeasts[0], amount: undefined, amountUnit: undefined }] }
    expect(scaleRecipe(none, 20, { name: 'x', equipmentProfileId: null }).yeasts[0].amount).toBeUndefined()
  })

  it('met à l’échelle le premier nombre des ajouts divers', () => {
    const scaled = scaleRecipe(recipe, 20, { name: 'x', equipmentProfileId: null })
    expect(scaled.otherIngredients[0].amount).toBe('2 tablette')
  })

  it('note d’où vient la copie sans perdre les notes d’origine', () => {
    const scaled = scaleRecipe(recipe, 20, { name: 'x', equipmentProfileId: null })
    expect(scaled.notes).toContain('Notes d’origine')
    expect(scaled.notes).toMatch(/10 L.*20 L/)
  })

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])('refuse un volume de %s', (volume) => {
    expect(() => scaleRecipe(recipe, volume, { name: 'x', equipmentProfileId: null })).toThrow()
  })

  it('refuse une recette sans volume de départ', () => {
    expect(() => scaleRecipe({ ...recipe, targetVolumeL: 0 }, 20, { name: 'x', equipmentProfileId: null })).toThrow()
  })
})

describe('scaleAmountText', () => {
  it.each([
    ['5 g', 2, '10 g'],
    ['1,5 c. à café', 2, '3 c. à café'],
    ['0.5 tablette', 3, '1,5 tablette'],
    ['une pincée', 2, 'une pincée'],
    ['', 2, ''],
    ['250 ml', 0.5, '125 ml'],
  ])('« %s » × %s → « %s »', (text, factor, expected) => {
    expect(scaleAmountText(text, factor)).toBe(expected)
  })
})
