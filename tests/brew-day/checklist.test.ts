import { describe, expect, it } from 'vitest'
import { checklistProgress, stepGuide } from '@/lib/brew-day/checklist'
import { buildBatchSteps } from '@/lib/brew-day/steps'
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

  it('names the yeast and expected OG when pitching', () => {
    const labels = stepGuide(step('pitch'), ctx).checklist.map((i) => i.label).join(' | ')
    expect(labels).toContain('US-05')
    expect(labels).toContain('1.050')
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
