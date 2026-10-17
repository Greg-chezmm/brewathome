import { describe, expect, it } from 'vitest'
import {
  batchSummary,
  brewhouseEfficiencyPercent,
  compareGravity,
  mashEfficiencyPercent,
  plannedMeasurements,
  type MeasurementValues,
} from '@/lib/brew-day/measurements'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

/** Le Barley wine brassé le 18/10/2025, tel que Brewfather le décrit. */
const barleyWine: RecipeDetails = {
  id: 'r1',
  name: 'Barley wine',
  status: 'validated',
  styleId: null,
  type: 'all-grain',
  targetVolumeL: 12,
  boilTimeMin: 120,
  mashEfficiencyPercent: 75,
  mashTempC: 67,
  mashSteps: [{ name: 'Saccharification', tempC: 67, timeMin: 60 }],
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: null,
  estOg: 1.109,
  estFg: 1.025,
  estIbu: null,
  estSrm: null,
  estAbv: null,
  createdAt: '2025-10-18',
  fermentables: [
    { name: 'Maris Otter', type: 'grain', amountKg: 4.5, colorLovibond: 3, yieldPercent: 82.5 },
    { name: 'Abbaye', type: 'grain', amountKg: 0.8, colorLovibond: 17, yieldPercent: 78 },
    { name: 'Cara Honey', type: 'grain', amountKg: 0.5, colorLovibond: 20, yieldPercent: 75 },
    { name: 'Orge torréfiée', type: 'grain', amountKg: 0.01, colorLovibond: 500, yieldPercent: 65 },
  ],
  hops: [],
  yeasts: [],
  otherIngredients: [],
}

const equipment: EquipmentProfile = {
  name: 'Cuve 30 L',
  boilKettleVolumeL: 30,
  mashTunVolumeL: null,
  targetBatchVolumeL: 12,
  boilTimeMin: 120,
  evaporationRateLPerHour: 3.14,
  grainAbsorptionLPerKg: 1,
  waterToGrainRatioLPerKg: 3,
  mashTunDeadspaceL: 0,
  hopAbsorptionL: 0.5,
  deadspaceL: 0,
  fermenterLossL: 0.7,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 75,
  hopUtilizationPercent: 100,
  method: 'all-grain',
}

/** Mesures relevées sur ce brassin dans Brewfather. */
const measured: MeasurementValues = {
  mashPh: null,
  preBoilVolumeL: 16,
  preBoilGravity: 1.063,
  postBoilVolumeL: 12.5,
  postBoilGravity: 1.085,
  fermenterTopUpL: 0,
  fermenterVolumeL: 10.8,
  og: 1.105,
  fg: 1.017,
  packagingVolumeL: 9.5,
  maxFermentationTempC: 18,
}

describe('Mesures du brassin', () => {
  it('efficacités à un demi-point près de Brewfather (52,93 % et 62,38 %)', () => {
    expect(Math.abs(mashEfficiencyPercent(barleyWine, 1.063, 16)! - 52.93)).toBeLessThan(0.6)
    expect(Math.abs(brewhouseEfficiencyPercent(barleyWine, 1.105, 10.8)! - 62.38)).toBeLessThan(0.6)
  })

  it('pas d’efficacité sans fermentable', () => {
    expect(mashEfficiencyPercent({ fermentables: [] }, 1.05, 20)).toBeNull()
  })

  it('valeurs prévues : volumes de l’équipement, DI/DF de la recette', () => {
    const planned = plannedMeasurements(barleyWine, equipment)
    expect(planned.fermenterVolumeL).toBe(12)
    expect(planned.og).toBe(1.109)
    expect(planned.fg).toBe(1.025)
    expect(planned.postBoilVolumeL).toBeCloseTo(12.5 / 0.96, 2)
    expect(planned.preBoilVolumeL).toBeCloseTo(12.5 / 0.96 + 6.28, 2)
    expect(planned.packagingVolumeL).toBeCloseTo(11.3, 5)
    // Sans équipement, pas de volumes ni de pré-ébullition connus.
    expect(plannedMeasurements(barleyWine, null).preBoilGravity).toBeNull()
  })

  it('résumé comme Brewfather : évaporation, pertes, alcool, atténuation', () => {
    const rows = Object.fromEntries(batchSummary(barleyWine, equipment, measured).map((row) => [row.label, row]))
    expect(rows['Évaporation par heure'].actual).toBeCloseTo(1.75, 5)
    expect(rows['Pertes trub/refroidissement'].actual).toBeCloseTo(1.2, 5)
    // Brewfather affiche 11,6 % ; son atténuation (82,6 %) suit une autre formule que l'apparente.
    expect(rows['Alcool'].actual).toBeCloseTo(11.55, 2)
    expect(rows['Atténuation apparente'].actual).toBeCloseTo(83.8, 1)
    expect(rows["Efficacité de l'empâtage"].planned).toBe(75)
  })

  it('compare une densité : tolérance de 2 points, conseil au-delà', () => {
    expect(compareGravity('og', 1.05, 1.052)).toEqual({ points: 2, verdict: 'ok', advice: null })
    const low = compareGravity('preBoilGravity', 1.074, 1.063)
    expect(low.points).toBe(-11)
    expect(low.verdict).toBe('low')
    expect(low.advice).toMatch(/prolonger l'ébullition/)
    expect(compareGravity('fg', 1.012, 1.02).advice).toMatch(/pas finie/)
  })
})
