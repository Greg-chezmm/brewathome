import { describe, expect, it } from 'vitest'
import { buildBatchSteps, planBatchStepsUpdate } from '@/lib/brew-day/steps'
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
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: null,
  estOg: null,
  estFg: null,
  estIbu: null,
  estSrm: null,
  estAbv: null,
  createdAt: '2026-01-01',
  fermentables: [{ name: 'Pale', type: 'grain', amountKg: 5, colorLovibond: 3, yieldPercent: 80 }],
  hops: [{ name: 'Cascade', amountG: 30, alphaAcidPercent: 6, timeMin: 15, use: 'boil' }],
  yeasts: [],
  otherIngredients: [],
}

/** Simule les étapes en base : ids + statuts. */
function persisted(r: RecipeDetails, statuses: Record<string, BatchStep['status']> = {}): BatchStep[] {
  return buildBatchSteps(r, null).map((s, i) => ({
    ...s,
    id: `s${i}`,
    status: statuses[s.stepType] ?? 'todo',
    actualStartAt: statuses[s.stepType] ? '2026-10-17T08:00:00Z' : null,
    checkedItems: [],
    notes: null,
  }))
}

describe('buildBatchSteps', () => {
  it('follows the brew day order, from preparation to cleanup', () => {
    const types = buildBatchSteps(recipe, null).map((s) => s.stepType)
    expect(types).toEqual([
      'preparation',
      'strike-water',
      'mash',
      'mash-out',
      'heat-to-boil',
      'boil',
      'hop-addition',
      'chiller-sanitize',
      'cooling',
      'pitch',
      'cleanup',
    ])
  })

  it('schedules the chiller sanitizing 15 min before the end of the boil, not at its start', () => {
    const chiller = buildBatchSteps({ ...recipe, boilTimeMin: 120 }, null).find((s) => s.stepType === 'chiller-sanitize')!
    expect(chiller.triggerTimeMin).toBe(15)
    // Ébullition plus courte que 15 min : dès le début.
    expect(buildBatchSteps({ ...recipe, boilTimeMin: 10 }, null).find((s) => s.stepType === 'chiller-sanitize')!.triggerTimeMin).toBe(10)
  })

  it('puts the mash temperature in the mash step', () => {
    const mash = buildBatchSteps({ ...recipe, mashTempC: 69 }, null).find((s) => s.stepType === 'mash')!
    expect(mash.label).toContain('69 °C')
  })
})

describe('planBatchStepsUpdate', () => {
  it('regenerates every step of a batch not started yet', () => {
    const changed = { ...recipe, hops: [...recipe.hops, { name: 'Citra', amountG: 20, alphaAcidPercent: 12, timeMin: 5, use: 'boil' as const }] }
    const existing = persisted(recipe)
    const plan = planBatchStepsUpdate(existing, buildBatchSteps(changed, null))

    expect(plan.deleteIds).toEqual(existing.map((s) => s.id))
    expect(plan.update).toEqual([])
    expect(plan.insert.map((s) => s.label)).toContain('Ajout houblon : Citra (20 g)')
    expect(plan.insert.map((s) => s.orderIndex)).toEqual(plan.insert.map((_, i) => i))
  })

  it('keeps started steps and applies the new boil time to the running boil', () => {
    const existing = persisted(recipe, { 'strike-water': 'done', mash: 'done', 'heat-to-boil': 'done', boil: 'in-progress' })
    const plan = planBatchStepsUpdate(existing, buildBatchSteps({ ...recipe, boilTimeMin: 90 }, null))

    const boil = existing.find((s) => s.stepType === 'boil')!
    expect(plan.deleteIds).not.toContain(boil.id)
    expect(plan.update.find((s) => s.id === boil.id)).toMatchObject({ plannedDurationMin: 90, label: 'Ébullition (90 min)' })
    expect(plan.insert.some((s) => s.stepType === 'boil')).toBe(false)
    expect(plan.insert.some((s) => s.label === 'Ajout houblon : Cascade (30 g)')).toBe(true)
  })

  it('keeps a done addition that was removed from the recipe, in place', () => {
    const existing = persisted(recipe, { 'hop-addition': 'done' })
    const plan = planBatchStepsUpdate(existing, buildBatchSteps({ ...recipe, hops: [] }, null))

    const cascade = existing.find((s) => s.stepType === 'hop-addition')!
    const kept = plan.update.find((s) => s.id === cascade.id)!
    expect(kept.label).toBe(cascade.label)
    const boilIndex = plan.insert.find((s) => s.stepType === 'boil')!.orderIndex
    expect(kept.orderIndex).toBe(boilIndex + 1)

    const allIndexes = [...plan.insert.map((s) => s.orderIndex), ...plan.update.map((s) => s.orderIndex)].sort((a, b) => a - b)
    expect(allIndexes).toEqual(allIndexes.map((_, i) => i))
  })
})

describe('buildBatchSteps — moment d’ajout des fermentescibles', () => {
  const withSugars: RecipeDetails = {
    ...recipe,
    fermentables: [
      { name: 'Pale', type: 'grain', amountKg: 5, colorLovibond: 3, yieldPercent: 80 },
      { name: 'Extrait clair', type: 'extract', amountKg: 0.5, colorLovibond: 3, yieldPercent: 80 },
      { name: 'Sucre candi', type: 'sugar', amountKg: 0.3, colorLovibond: 1, yieldPercent: 100 },
      { name: 'Dextrose', type: 'sugar', amountKg: 0.2, colorLovibond: 0, yieldPercent: 100, use: 'fermentation' },
    ],
    hops: [{ name: 'Citra', amountG: 50, alphaAcidPercent: 12, timeMin: 0, use: 'dry-hop', dryHopDays: 4, dryHopDay: 6 }],
  }
  const steps = buildBatchSteps(withSugars, null)

  it('n’empâte que les fermentescibles d’empâtage', () => {
    const mash = steps.find((s) => s.stepType === 'mash')!
    expect(mash.label).toContain('5 kg Pale')
    expect(mash.label).not.toContain('Sucre')
  })

  it('ajoute l’extrait au début de l’ébullition et le sucre 10 min avant la fin', () => {
    expect(steps.find((s) => s.label.includes('Extrait clair'))).toMatchObject({ stepType: 'other-addition', triggerTimeMin: 60 })
    expect(steps.find((s) => s.label.includes('Sucre candi'))).toMatchObject({ stepType: 'other-addition', triggerTimeMin: 10 })
  })

  it('prévoit le sucre de fermentation et le jour du dry hop', () => {
    expect(steps.find((s) => s.stepType === 'fermentation-addition')?.label).toBe('Ajout en fermentation : Dextrose (200 g)')
    expect(steps.find((s) => s.stepType === 'dry-hop-addition')?.label).toBe('Houblonnage à froid au jour 6 : Citra (50 g) — 4 j')
  })
})

describe('ajouts d’ébullition au même moment', () => {
  const grouped: RecipeDetails = {
    ...recipe,
    hops: [
      { name: 'Cascade', amountG: 30, alphaAcidPercent: 6, timeMin: 10, use: 'boil' },
      { name: 'Citra', amountG: 20, alphaAcidPercent: 12, timeMin: 10, use: 'boil' },
      { name: 'Magnum', amountG: 15, alphaAcidPercent: 12, timeMin: 60, use: 'boil' },
    ],
    otherIngredients: [{ name: 'Whirlfloc', amount: '1 pastille', timeMin: 10 }],
  }
  const additions = buildBatchSteps(grouped, null).filter((s) => s.stepType.endsWith('-addition') && s.triggerTimeMin !== null)

  it('réunit en une seule étape les ajouts prévus au même moment', () => {
    expect(additions.map((s) => s.triggerTimeMin)).toEqual([60, 10])
    expect(additions[1].label).toBe('Ajouts à 10 min de la fin : Cascade (30 g), Citra (20 g), Whirlfloc (1 pastille)')
    expect(additions[1].stepType).toBe('other-addition')
  })

  it('garde le libellé habituel pour un ajout seul', () => {
    expect(additions[0].label).toBe('Ajout houblon : Magnum (15 g)')
  })

  it('reste une étape de houblon quand il n’y a que des houblons', () => {
    const hopsOnly = buildBatchSteps({ ...grouped, otherIngredients: [] }, null).find((s) => s.label.startsWith('Ajouts à'))
    expect(hopsOnly?.stepType).toBe('hop-addition')
  })
})

describe('ajouts divers en fermentation (copeaux de chêne…)', () => {
  const oak: RecipeDetails = {
    ...recipe,
    otherIngredients: [
      { name: 'Whirlfloc', amount: '1 pastille', timeMin: 10 },
      { name: 'Copeaux de chêne', amount: '65 g', timeMin: 0, use: 'fermentation', day: 14, contactDays: 21 },
    ],
  }

  it('génère une étape dédiée, avec jour et durée de contact, hors de l’ébullition', () => {
    const steps = buildBatchSteps(oak, null)
    const addition = steps.find((s) => s.stepType === 'other-fermentation-addition')
    expect(addition?.label).toBe('Ajout en fermentation au jour 14 : Copeaux de chêne (65 g) — 21 j de contact')
    expect(addition?.plannedDurationMin).toBe(21 * 24 * 60)
    expect(steps.filter((s) => s.stepType === 'other-addition').map((s) => s.label)).toEqual(['Ajout : Whirlfloc (1 pastille)'])
  })

  it('n’est pas confondu avec un ajout de sucre (le calcul d’alcool ne l’attend pas)', () => {
    expect(buildBatchSteps(oak, null).some((s) => s.stepType === 'fermentation-addition')).toBe(false)
  })
})
