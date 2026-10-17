import { describe, expect, it } from 'vitest'
import { batchHistoryRow, historyInsights, historyStats, type BatchHistoryRow } from '@/lib/batches/history'
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
