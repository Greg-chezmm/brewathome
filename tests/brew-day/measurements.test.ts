import { describe, expect, it } from 'vitest'
import { calculateABV_simple } from '@/lib/brew-calc/abv'
import { fermentationAdditionsGravity } from '@/lib/brew-calc/gravity'
import { computeRecipe } from '@/lib/brew-calc/recipe-stats'
import {
  batchSummary,
  brewhouseEfficiencyPercent,
  compareGravity,
  effectiveOg,
  mashEfficiencyPercent,
  measuredAbv,
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

  it('sans ajout en fermentation, l’alcool reste celui de (DI, DF) et la DI prévue celle de la recette', () => {
    expect(measuredAbv(barleyWine, 1.105, 1.017, 10.8)).toEqual({
      abv: calculateABV_simple(1.105, 1.017),
      effectiveOg: 1.105,
      fermentationAbv: 0,
    })
    const alcohol = batchSummary(barleyWine, equipment, measured).find((row) => row.label === 'Alcool')!
    expect(alcohol.note).toBeNull()
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

describe('Alcool mesuré : sucre ajouté en fermentation', () => {
  /** Blonde de 10 L : 200 g de sucre candi (rendement 78 %) ajoutés en fermentation. */
  const blonde: RecipeDetails = {
    ...barleyWine,
    name: 'Blonde',
    targetVolumeL: 10,
    boilTimeMin: 60,
    estOg: 1.05,
    estFg: 1.01,
    fermentables: [
      { name: 'Pilsner', type: 'grain', amountKg: 2.2, colorLovibond: 2, yieldPercent: 80 },
      { name: 'Sucre candi clair', type: 'sugar', amountKg: 0.2, colorLovibond: 1, yieldPercent: 78, use: 'fermentation' },
    ],
  }
  const grainOnly: RecipeDetails = { ...blonde, fermentables: blonde.fermentables.slice(0, 1) }
  const blondeMeasured: MeasurementValues = { ...measured, og: 1.045, fg: 1.008, fermenterVolumeL: 10, preBoilGravity: null }

  it('hausse de densité : masse × rendement, sans efficacité, diluée dans le volume', () => {
    // 0,2 kg × 78 % × 46 PPG × 8,345 → 59,9 points·L, soit 6 points dans 10 L.
    expect(fermentationAdditionsGravity(blonde.fermentables, 10)).toBeCloseTo(0.005988, 5)
    expect(fermentationAdditionsGravity(grainOnly.fermentables, 10)).toBe(0)
    expect(fermentationAdditionsGravity(blonde.fermentables, 0)).toBe(0)
  })

  it('200 g de sucre dans 10 L : l’alcool mesuré monte d’environ 0,7-0,8 %', () => {
    const withoutCorrection = calculateABV_simple(1.045, 1.008)
    const result = measuredAbv(blonde, 1.045, 1.008, 10)
    expect(result.abv - withoutCorrection).toBeGreaterThan(0.7)
    expect(result.abv - withoutCorrection).toBeLessThan(0.8)
    expect(result.fermentationAbv).toBeCloseTo(result.abv - withoutCorrection, 10)
    expect(result.effectiveOg).toBeCloseTo(1.050988, 5)
    // Saccharose pur (rendement 100 %) : ≈ +1 %.
    const sucrose = { ...blonde, fermentables: [blonde.fermentables[0], { ...blonde.fermentables[1], yieldPercent: 100 }] }
    expect(measuredAbv(sucrose, 1.045, 1.008, 10).fermentationAbv).toBeCloseTo(1.01, 2)
  })

  it('dilue le sucre dans le volume en fermenteur mesuré, à défaut prévu', () => {
    expect(effectiveOg(blonde, 1.045, 8) - 1.045).toBeCloseTo(0.005988 * (10 / 8), 5)
    expect(effectiveOg(blonde, 1.045, null)).toBeCloseTo(effectiveOg(blonde, 1.045, 10), 10)
  })

  it('DI prévue sans le sucre (celle qu’on mesurera), alcool prévu inchangé', () => {
    const planned = plannedMeasurements(blonde, null)
    expect(planned.og).toBeCloseTo(1.05 - 0.005988, 5)
    expect(planned.fg).toBe(1.01)
    const rows = Object.fromEntries(batchSummary(blonde, null, blondeMeasured).map((row) => [row.label, row]))
    expect(rows['Alcool'].planned).toBeCloseTo(calculateABV_simple(1.05, 1.01), 5)
    // Sans DI enregistrée, la DI prévue est la densité de fin d'ébullition calculée.
    const computed = plannedMeasurements({ ...blonde, estOg: null, estFg: null }, null)
    expect(computed.og).toBeCloseTo(computeRecipe({ ...blonde, equipment: null }).postBoilGravity, 10)
  })

  it('résumé : alcool et atténuation depuis la DI effective, mention du sucre', () => {
    const rows = Object.fromEntries(batchSummary(blonde, null, blondeMeasured).map((row) => [row.label, row]))
    expect(rows['Alcool'].actual).toBeCloseTo(calculateABV_simple(1.050988, 1.008), 3)
    expect(rows['Alcool'].note).toBe('dont +0,8 % de sucre ajouté en fermentation')
    expect(rows['Atténuation apparente'].actual).toBeCloseTo(((1.050988 - 1.008) / 0.050988) * 100, 1)
    // Sans ajout en fermentation : mêmes mesures, alcool brut et pas de mention.
    const plain = Object.fromEntries(batchSummary(grainOnly, null, blondeMeasured).map((row) => [row.label, row]))
    expect(plain['Alcool'].actual).toBeCloseTo(calculateABV_simple(1.045, 1.008), 10)
    expect(plain['Alcool'].note).toBeNull()
  })

  it('efficacité de la brasserie : le sucre ajouté en fermentation n’entre pas dans le potentiel', () => {
    expect(brewhouseEfficiencyPercent(blonde, 1.045, 10)).toBeCloseTo(brewhouseEfficiencyPercent(grainOnly, 1.045, 10)!, 10)
  })
})
