import { describe, expect, it } from 'vitest'
import { checklistProgress, stepGuide } from '@/lib/brew-day/checklist'
import { buildBatchSteps } from '@/lib/brew-day/steps'
import type { VolumeBreakdown } from '@/lib/brew-calc/volumes'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const recipe: RecipeDetails = {
  id: 'r1',
  name: 'Pale Ale',
  status: 'validated',
  styleId: null,
  type: 'all-grain',
  targetVolumeL: 20,
  boilTimeMin: 60,
  mashEfficiencyPercent: 72,
  mashTempC: 69,
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: null,
  estOg: 1.05,
  estFg: null,
  estIbu: null,
  estSrm: null,
  estAbv: null,
  createdAt: '2026-01-01',
  fermentables: [
    { name: 'Pale', type: 'grain', amountKg: 5, colorLovibond: 3, yieldPercent: 80 },
    { name: 'Crystal', type: 'grain', amountKg: 0.3, colorLovibond: 60, yieldPercent: 75 },
  ],
  hops: [],
  yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 78 }],
  otherIngredients: [],
}

const steps: BatchStep[] = buildBatchSteps(recipe, null).map((s, i) => ({ ...s, id: `s${i}`, checkedItems: [], notes: null }))
const step = (type: BatchStep['stepType']) => steps.find((s) => s.stepType === type)!
const ctx = { recipe, volumes: null, method: 'all-grain' as const }

describe('stepGuide', () => {
  it('lists every grain to pour during the mash', () => {
    const labels = stepGuide(step('mash'), ctx).checklist.map((i) => i.label)
    expect(labels).toContain('Verser 5 kg de Pale')
    expect(labels).toContain('Verser 300 g de Crystal')
  })

  it('explains the effect of a hot mash', () => {
    expect(stepGuide(step('mash'), ctx).tips[0]).toMatch(/plus ronde/)
  })

  it('marks the iodine test and the mash-out as optional', () => {
    expect(stepGuide(step('mash'), ctx).checklist.find((i) => i.id === 'iodine')?.optional).toBe(true)
    expect(stepGuide(step('mash-out'), ctx).optional).toBe(true)
  })

  it('sort le sac après le rinçage (BIAB), pas à la montée en ébullition', () => {
    const volumes = { mashWaterL: 18, spargeWaterL: 6, preBoilVolumeL: 25 } as VolumeBreakdown
    const biab = { recipe, volumes, method: 'biab' as const }
    // Sans profil d'équipement, la recette n'a pas d'étape de rinçage : on en fabrique une.
    const ids = (type: BatchStep['stepType']) =>
      stepGuide({ ...step('boil'), stepType: type }, biab).checklist.map((i) => i.id)
    expect(ids('sparge')).toContain('bag-out')
    expect(ids('heat-to-boil')).not.toContain('bag-out')
  })

  it('sort le sac à la montée en ébullition quand il n’y a pas de rinçage (BIAB)', () => {
    const biab = { recipe, volumes: null, method: 'biab' as const }
    expect(stepGuide(step('heat-to-boil'), biab).checklist.map((i) => i.id)).toContain('bag-out')
  })

  it('names the yeast and expected OG when pitching', () => {
    const labels = stepGuide(step('pitch'), ctx).checklist.map((i) => i.label).join(' | ')
    expect(labels).toContain('US-05')
    expect(labels).toContain('1.050')
  })
})

describe('stepGuide — préparation du malt pour le moulin', () => {
  const prep = (r: RecipeDetails) => stepGuide(step('preparation'), { ...ctx, recipe: r }).checklist

  it('détaille chaque grain à peser avant le moulin', () => {
    const labels = prep(recipe).map((i) => i.label)
    expect(labels).toContain('Peser 5 kg de Pale')
    expect(labels).toContain('Peser 300 g de Crystal')
  })

  it('met les pesées avant la case du moulin, qui garde son identifiant et son total', () => {
    const items = prep(recipe)
    const ids = items.map((i) => i.id)
    expect(ids).toContain('weigh-grain-0')
    expect(ids).toContain('weigh-grain-1')
    expect(ids.indexOf('weigh-grain-1')).toBeLessThan(ids.indexOf('mill'))
    const mill = items.find((i) => i.id === 'mill')!
    expect(mill.optional).toBe(true)
    expect(mill.label).toContain('5.30 kg')
  })

  it('ne liste que les grains : le sucre et l’extrait ne passent pas au moulin', () => {
    const withSugar: RecipeDetails = {
      ...recipe,
      fermentables: [...recipe.fermentables, { name: 'Sucre candi', type: 'sugar', amountKg: 0.4, colorLovibond: 1, yieldPercent: 100 }],
    }
    const labels = prep(withSugar).map((i) => i.label)
    expect(labels.some((l) => l.includes('Sucre candi'))).toBe(false)
    expect(prep(withSugar).filter((i) => i.id.startsWith('weigh-grain-'))).toHaveLength(2)
  })

  it('n’ajoute aucune pesée de grain à une recette sans grain', () => {
    const extract: RecipeDetails = {
      ...recipe,
      type: 'extract',
      fermentables: [{ name: 'Extrait de malt', type: 'extract', amountKg: 3, colorLovibond: 8, yieldPercent: 78 }],
    }
    expect(prep(extract).some((i) => i.id.startsWith('weigh-grain-'))).toBe(false)
  })

  it('compte les pesées dans l’avancement, pas le moulin facultatif', () => {
    const prepStep = { ...step('preparation'), checkedItems: ['weigh-grain-0', 'mill'] }
    const guide = stepGuide(prepStep, ctx)
    const required = guide.checklist.filter((i) => !i.optional).length
    expect(checklistProgress(guide, prepStep)).toEqual({ done: 1, total: required })
    expect(guide.checklist.filter((i) => !i.optional).map((i) => i.id)).toEqual(
      expect.arrayContaining(['weigh-grain-0', 'weigh-grain-1']),
    )
  })
})

describe('checklistProgress', () => {
  it('counts only required items that still exist', () => {
    const mash = { ...step('mash'), checkedItems: ['grain-0', 'iodine', 'removed-item'] }
    const guide = stepGuide(mash, ctx)
    const required = guide.checklist.filter((i) => !i.optional).length
    expect(checklistProgress(guide, mash)).toEqual({ done: 1, total: required })
  })
})

describe('stepGuide — ajouts regroupés', () => {
  it('propose une case par ingrédient de l’étape regroupée', () => {
    const grouped: RecipeDetails = {
      ...recipe,
      hops: [
        { name: 'Cascade', amountG: 30, alphaAcidPercent: 6, timeMin: 10, use: 'boil' },
        { name: 'Citra', amountG: 20, alphaAcidPercent: 12, timeMin: 10, use: 'boil' },
      ],
    }
    const addition = buildBatchSteps(grouped, null)
      .map((s, i) => ({ ...s, id: `g${i}`, checkedItems: [], notes: null }))
      .find((s) => s.label.startsWith('Ajouts à'))!
    const guide = stepGuide(addition, { recipe: grouped, volumes: null, method: 'all-grain' })
    expect(guide.checklist.map((i) => i.label)).toEqual(['Ajouter Cascade (30 g)', 'Ajouter Citra (20 g)', 'Remuer pour bien disperser'])
    expect(guide.tips[0]).toMatch(/Ajout tardif/)
  })
})
