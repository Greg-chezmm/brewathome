import { describe, expect, it } from 'vitest'
import { measuredResults, withAppliedResults } from '@/lib/batches/apply-results'
import { computeRecipe } from '@/lib/brew-calc/recipe-stats'
import { MEASUREMENTS, mashEfficiencyPercent, type MeasurementValues } from '@/lib/brew-day/measurements'
import type { BatchDetails } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const recipe: RecipeDetails = {
  id: 'r1',
  name: 'Pale ale',
  status: 'validated',
  styleId: null,
  type: 'all-grain',
  targetVolumeL: 10,
  boilTimeMin: 60,
  mashEfficiencyPercent: 75,
  mashTempC: 65,
  mashSteps: [{ name: 'Saccharification', tempC: 65, timeMin: 60 }],
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: null,
  estOg: null,
  estFg: null,
  estIbu: null,
  estSrm: null,
  estAbv: null,
  createdAt: '2026-01-01',
  fermentables: [{ name: 'Pale ale', type: 'grain', amountKg: 2.2, colorLovibond: 3, yieldPercent: 80 }],
  hops: [],
  yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 78 }],
  otherIngredients: [],
  fermentationSteps: [],
  carbonationVols: null,
}

const noMeasurements = Object.fromEntries(Object.keys(MEASUREMENTS).map((k) => [k, null])) as MeasurementValues

function batch(measurements: Partial<MeasurementValues>): BatchDetails {
  return {
    id: 'b1',
    name: 'Pale ale #1',
    status: 'completed',
    brewDate: '2026-02-01',
    createdAt: '2026-01-30T10:00:00Z',
    recipeId: 'r1',
    recipeSnapshot: recipe,
    ogMeasured: null,
    fgMeasured: null,
    measurements: { ...noMeasurements, ...measurements },
    volumeMeasuredL: null,
    notes: null,
    brewfatherId: null,
    brewSessions: 1,
    sessionMeasurements: [],
  }
}

describe('Résultats mesurés d’un brassin', () => {
  it('efficacité d’empâtage depuis la densité et le volume pré-ébullition, au demi-point', () => {
    const results = measuredResults(batch({ preBoilGravity: 1.04, preBoilVolumeL: 13 }), null)
    const exact = mashEfficiencyPercent(recipe, 1.04, 13)!
    expect(results.mashEfficiency).toBe(Math.round(exact * 2) / 2)
    expect(results.plannedMashEfficiency).toBe(75)
  })

  it('atténuation de levure corrigée de l’empâtage : la recette retombe sur la DF mesurée', () => {
    // 1.050 → 1.010 : 80 % apparents, empâtage à 65 °C (2 °C sous la référence, +2 points).
    const results = measuredResults(batch({ og: 1.05, fg: 1.01 }), null)
    expect(results.attenuation).toBe(80)
    expect(results.yeastAttenuation).toBe(78)
    expect(results.plannedAttenuation).toBe(80)
    const updated = withAppliedResults(recipe, { yeastAttenuationPercent: results.yeastAttenuation!, yeastName: results.yeastName })
    expect(computeRecipe(updated).attenuationPercent).toBeCloseTo(80, 10)
  })

  it('sans mesures : rien à reporter', () => {
    const results = measuredResults(batch({ og: 1.05 }), null)
    expect(results.mashEfficiency).toBeNull()
    expect(results.yeastAttenuation).toBeNull()
  })
})

describe('Report sur une recette', () => {
  it('efficacité et atténuation de la levure principale', () => {
    const updated = withAppliedResults(recipe, { mashEfficiencyPercent: 68.5, yeastAttenuationPercent: 81, yeastName: 'US-05' })
    expect(updated.mashEfficiencyPercent).toBe(68.5)
    expect(updated.yeasts[0].attenuationPercent).toBe(81)
  })

  it('levure changée depuis le brassin : l’atténuation ne s’applique pas', () => {
    const updated = withAppliedResults(recipe, { mashEfficiencyPercent: 70, yeastAttenuationPercent: 81, yeastName: 'S-04' })
    expect(updated.mashEfficiencyPercent).toBe(70)
    expect(updated.yeasts).toBe(recipe.yeasts)
  })
})
