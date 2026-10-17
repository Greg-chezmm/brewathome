import { describe, expect, it } from 'vitest'
import { batchHistoryRow, historyInsights, historyStats, type BatchHistoryRow } from '@/lib/batches/history'
import { calculateABV_simple } from '@/lib/brew-calc/abv'
import { computeRecipe } from '@/lib/brew-calc/recipe-stats'
import { MEASUREMENTS, type MeasurementValues } from '@/lib/brew-day/measurements'
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
  mashTempC: 66,
  mashSteps: [{ name: 'Saccharification', tempC: 66, timeMin: 60 }],
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

function batch(id: string, measurements: Partial<MeasurementValues>): BatchDetails {
  return {
    id,
    name: `Brassin ${id}`,
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
  }
}

describe('batchHistoryRow', () => {
  it('met en regard le prévu de la recette et le mesuré', () => {
    const row = batchHistoryRow(batch('1', { og: 1.05, fg: 1.01, fermenterVolumeL: 9.5 }))
    expect(row.plannedOg).toBeGreaterThan(1.03)
    expect(row.og).toBe(1.05)
    expect(row.abv).toBeCloseTo(5.25, 1)
    expect(row.attenuation).toBeCloseTo(80, 5)
    expect(row.plannedMashEfficiency).toBe(75)
    expect(row.brewhouseEfficiency).not.toBeNull()
    expect(row.mashEfficiency).toBeNull()
    expect(row.yeastName).toBe('US-05')
    expect(row.date).toBe('2026-02-01')
  })

  it('sans ajout en fermentation, l’alcool mesuré reste celui de (DI, DF)', () => {
    const row = batchHistoryRow(batch('1', { og: 1.05, fg: 1.01, fermenterVolumeL: 10 }))
    expect(row.abv).toBeCloseTo(calculateABV_simple(1.05, 1.01), 10)
    expect(row.fermentationAbv).toBeNull()
  })

  it('compte le sucre ajouté en fermentation dans l’alcool mesuré (200 g dans 10 L)', () => {
    const sugar = { name: 'Sucre candi clair', type: 'sugar' as const, amountKg: 0.2, colorLovibond: 1, yieldPercent: 78, use: 'fermentation' as const }
    const withSugar = { ...recipe, fermentables: [...recipe.fermentables, sugar] }
    const plain = batchHistoryRow(batch('1', { og: 1.05, fg: 1.01, fermenterVolumeL: 10 }))
    const row = batchHistoryRow({ ...batch('2', { og: 1.05, fg: 1.01, fermenterVolumeL: 10 }), recipeSnapshot: withSugar })
    expect(row.abv! - plain.abv!).toBeGreaterThan(0.7)
    expect(row.abv! - plain.abv!).toBeLessThan(0.8)
    expect(row.fermentationAbv).toBeCloseTo(row.abv! - plain.abv!, 10)
    // Atténuation depuis la DI effective : la levure a fermenté le sucre aussi.
    expect(row.attenuation).toBeGreaterThan(plain.attenuation!)
    // Prévu : DI sans le sucre (celle qu'on mesure), alcool calculé comme la recette (sucre compris).
    const planned = computeRecipe({ ...withSugar, equipment: null })
    expect(row.plannedOg).toBeCloseTo(planned.postBoilGravity, 10)
    expect(row.plannedAbv).toBeCloseTo(planned.abv, 10)
  })

  it('reste vide quand rien n’a été mesuré', () => {
    const row = batchHistoryRow(batch('1', {}))
    expect(row.og).toBeNull()
    expect(row.abv).toBeNull()
    expect(row.attenuation).toBeNull()
    expect(row.plannedAbv).not.toBeNull()
  })
})

describe('historyStats et historyInsights', () => {
  const row = (over: Partial<BatchHistoryRow>): BatchHistoryRow => ({
    ...batchHistoryRow(batch('x', {})),
    plannedOg: 1.05,
    plannedAttenuation: 78,
    plannedVolumeL: 10,
    ...over,
  })

  it('moyenne les écarts en ignorant les valeurs manquantes', () => {
    const stats = historyStats([
      row({ og: 1.045, mashEfficiency: 68, attenuation: 72, fermenterVolumeL: 9 }),
      row({ og: 1.047, mashEfficiency: 70, attenuation: null, fermenterVolumeL: 8.6 }),
      row({ og: null }),
    ])
    expect(stats.ogGapPoints).toBeCloseTo(-4, 5)
    expect(stats.mashEfficiency).toBeCloseTo(69, 5)
    expect(stats.plannedMashEfficiency).toBe(75)
    expect(stats.attenuationGap).toBeCloseTo(-6, 5)
    expect(stats.volumeGapL).toBeCloseTo(-1.2, 5)
  })

  it('conseille de régler l’efficacité mesurée et signale les écarts nets', () => {
    const stats = historyStats([
      row({ og: 1.045, mashEfficiency: 68, attenuation: 72, fermenterVolumeL: 9 }),
      row({ og: 1.047, mashEfficiency: 70, attenuation: 73, fermenterVolumeL: 8.6 }),
    ])
    const insights = historyInsights(stats, 2)
    expect(insights[0]).toContain('Réglez 69 %')
    expect(insights.some((i) => i.includes('sous la prévision'))).toBe(true)
    expect(insights.some((i) => i.includes('L de moins'))).toBe(true)
  })

  it('ne tire aucune conclusion d’un seul brassin ni d’écarts faibles', () => {
    const stats = historyStats([row({ og: 1.049, mashEfficiency: 74, attenuation: 77, fermenterVolumeL: 10.2 })])
    expect(historyInsights(stats, 1)).toEqual([])
    expect(historyInsights(stats, 2)).toEqual([])
  })
})
