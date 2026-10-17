import { describe, expect, it } from 'vitest'
import { stepGuide } from '@/lib/brew-day/checklist'
import { buildBatchSteps, strikeWaterTempFor } from '@/lib/brew-day/steps'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'
import type { EquipmentProfile } from '@/lib/brew-calc/types'

const equipment: EquipmentProfile = {
  name: 'Cuve 35 L',
  boilKettleVolumeL: 35,
  mashTunVolumeL: null,
  targetBatchVolumeL: 20,
  boilTimeMin: 60,
  evaporationRateLPerHour: 3,
  grainAbsorptionLPerKg: 1,
  waterToGrainRatioLPerKg: 3,
  mashTunDeadspaceL: 0,
  hopAbsorptionL: 0.5,
  deadspaceL: 0,
  fermenterLossL: 0.5,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 72,
  hopUtilizationPercent: 100,
  method: 'all-grain',
}

const recipe: RecipeDetails = {
  id: 'r1',
  name: 'Weizen',
  status: 'validated',
  styleId: null,
  type: 'all-grain',
  targetVolumeL: 20,
  boilTimeMin: 60,
  mashEfficiencyPercent: 72,
  mashTempC: 64,
  mashSteps: [
    { name: 'Repos protéinique', tempC: 52, timeMin: 15 },
    { name: 'Bêta-amylase', tempC: 64, timeMin: 45 },
    { name: 'Alpha-amylase', tempC: 72, timeMin: 20 },
    { name: 'Mash-out', tempC: 77, timeMin: 10 },
  ],
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: null,
  estOg: null,
  estFg: null,
  estIbu: null,
  estSrm: null,
  estAbv: null,
  createdAt: '2026-01-01',
  fermentables: [{ name: 'Blé', type: 'grain', amountKg: 5, colorLovibond: 2, yieldPercent: 80 }],
  hops: [],
  yeasts: [],
  otherIngredients: [],
}

const generated = buildBatchSteps(recipe, equipment)
const steps: BatchStep[] = generated.map((s, i) => ({ ...s, id: `s${i}`, checkedItems: [] }))
const mashSteps = steps.filter((s) => ['mash', 'mash-step', 'mash-out'].includes(s.stepType))
const ctx = { recipe, volumes: null, method: 'all-grain' as const }

describe('Brew Day avec paliers', () => {
  it('une étape minutée par palier, dans l’ordre', () => {
    expect(mashSteps.map((s) => [s.stepType, s.plannedDurationMin])).toEqual([
      ['mash', 15],
      ['mash-step', 45],
      ['mash-step', 20],
      ['mash-out', 10],
    ])
    expect(mashSteps[0].label).toMatch(/^Empâtage à 52 °C — ajouter le grain/)
    expect(mashSteps[1].label).toBe('Palier « Bêta-amylase » : 64 °C pendant 45 min')
    expect(mashSteps[3].label).toBe('Mash-out à 77 °C')
  })

  it('l’eau d’empâtage vise le premier palier, pas le principal', () => {
    const strike = steps.find((s) => s.stepType === 'strike-water')!
    const expected = strikeWaterTempFor(52, 5, 15)!
    expect(strike.label).toContain(`${expected.toFixed(0)} °C`)
    expect(expected).toBeLessThan(strikeWaterTempFor(64, 5, 15)!)
  })

  it('pas de mash-out ajouté si la recette n’en a pas', () => {
    const types = buildBatchSteps({ ...recipe, mashSteps: [{ name: 'Infusion', tempC: 66, timeMin: 60 }] }, null).map(
      (s) => s.stepType,
    )
    expect(types).toContain('mash')
    expect(types).not.toContain('mash-out')
    expect(types).not.toContain('mash-step')
  })

  it('le guide d’un palier donne sa température, sa durée et son rôle', () => {
    const beta = stepGuide(mashSteps[1], ctx)
    expect(beta.checklist.map((i) => i.label)).toEqual(
      expect.arrayContaining(['Monter à 64 °C en remuant sans arrêt (chauffe douce)', 'Maintenir 45 min, cuve couverte']),
    )
    expect(beta.tips[0]).toMatch(/bêta-amylase/)
  })

  it('test à l’iode seulement sur le palier principal', () => {
    const ids = (s: BatchStep) => stepGuide(s, ctx).checklist.map((i) => i.id)
    expect(ids(mashSteps[0])).not.toContain('iodine')
    expect(ids(mashSteps[1])).toContain('iodine')
    expect(ids(mashSteps[2])).not.toContain('iodine')
  })

  it('le mash-out reprend la température et la durée de la recette', () => {
    const labels = stepGuide(mashSteps[3], ctx).checklist.map((i) => i.label)
    expect(labels[0]).toContain('77 °C')
    expect(labels[1]).toBe('Maintenir 10 min')
  })
})
