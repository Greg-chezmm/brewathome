import { describe, expect, it } from 'vitest'
import { measuredResults } from '@/lib/batches/apply-results'
import { nextVersionName, recipeInputFromSnapshot } from '@/lib/batches/new-version'
import { MEASUREMENTS, type MeasurementValues } from '@/lib/brew-day/measurements'
import type { BatchDetails } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const snapshot: RecipeDetails = {
  id: 'r1',
  name: 'Brune forte',
  status: 'validated',
  styleId: '26D',
  type: 'all-grain',
  targetVolumeL: 10,
  boilTimeMin: 75,
  mashEfficiencyPercent: 75,
  mashTempC: 67,
  mashSteps: [{ name: 'Saccharification', tempC: 67, timeMin: 60 }],
  ibuFormula: 'garetz',
  equipmentProfileId: 'e1',
  notes: 'Retouche : +100 g de sucre candi.',
  estOg: 1.08,
  estFg: 1.016,
  estIbu: 30,
  estSrm: 30,
  estAbv: 8.4,
  createdAt: '2026-01-01',
  fermentables: [{ name: 'Pale', type: 'grain', amountKg: 3, colorLovibond: 3, yieldPercent: 80 }],
  hops: [{ name: 'Magnum', amountG: 15, alphaAcidPercent: 12, timeMin: 60, use: 'boil' }],
  yeasts: [{ name: 'BE-256', type: 'dry', style: 'belgian', attenuationPercent: 82 }],
  otherIngredients: [],
  fermentationSteps: [{ type: 'primary', tempC: 19, days: 14 }],
  carbonationVols: 2.6,
}

describe('nextVersionName', () => {
  it('ajoute ou incrémente le numéro de version', () => {
    expect(nextVersionName('Brune forte')).toBe('Brune forte v2')
    expect(nextVersionName('Brune forte v2')).toBe('Brune forte v3')
    expect(nextVersionName('Brune forte V9')).toBe('Brune forte v10')
  })

  it('saute les noms déjà pris', () => {
    expect(nextVersionName('Brune forte', ['Brune forte v2', 'brune forte v3'])).toBe('Brune forte v4')
  })
})

describe('recipeInputFromSnapshot', () => {
  const origin = { name: 'Brune forte #1', date: '2026-02-01' }

  it('reprend la recette du brassin telle quelle, sous le nouveau nom, avec son origine en note', () => {
    const input = recipeInputFromSnapshot(snapshot, { name: 'Brune forte v2', origin })
    expect(input).toMatchObject({
      name: 'Brune forte v2',
      styleId: '26D',
      boilTimeMin: 75,
      ibuFormula: 'garetz',
      equipmentProfileId: 'e1',
      carbonationVols: 2.6,
      fermentables: snapshot.fermentables,
      fermentationSteps: snapshot.fermentationSteps,
    })
    expect(input).not.toHaveProperty('id')
    expect(input).not.toHaveProperty('estOg')
    expect(input.notes).toBe("Retouche : +100 g de sucre candi.\n\nNouvelle version d'après le brassin « Brune forte #1 » du 01/02/2026.")
  })

  it('avec les résultats mesurés : efficacité et atténuation reportées', () => {
    const noMeasurements = Object.fromEntries(Object.keys(MEASUREMENTS).map((k) => [k, null])) as MeasurementValues
    const batch = {
      recipeSnapshot: snapshot,
      measurements: { ...noMeasurements, og: 1.08, fg: 1.012, preBoilGravity: 1.06, preBoilVolumeL: 12 },
      ogMeasured: null,
      fgMeasured: null,
      volumeMeasuredL: null,
    } as BatchDetails
    const results = measuredResults(batch, null)
    const input = recipeInputFromSnapshot(snapshot, { name: 'v2', origin, results })
    expect(input.mashEfficiencyPercent).toBe(results.mashEfficiency)
    expect(input.yeasts[0].attenuationPercent).toBe(85)
    expect(input.notes).toMatch(/avec ses résultats mesurés\.$/)
  })

  it('profil d’équipement supprimé depuis : la nouvelle recette n’en a plus', () => {
    expect(recipeInputFromSnapshot(snapshot, { name: 'v2', origin, keepEquipment: false }).equipmentProfileId).toBeNull()
  })
})
