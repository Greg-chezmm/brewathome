import { describe, expect, it } from 'vitest'
import { primingSugarGrams, residualCO2Volumes } from '@/lib/brew-calc/carbonation'
import { hopstandUtilizationFactor, tinsethContributions } from '@/lib/brew-calc/ibu'
import { computeRecipe } from '@/lib/brew-calc/recipe-stats'
import type { EquipmentProfile, Fermentable, Hop } from '@/lib/brew-calc/types'

/**
 * Cas de test de référence des specs (« Specs appli de brassage — modèle de données
 * et moteur de calcul », Pale Ale de 23 L) : le moteur doit retrouver ces valeurs
 * à l'arrondi près.
 */
const SUCROSE_PPG = 46
const ppgToYield = (ppg: number) => (ppg / SUCROSE_PPG) * 100

const equipment: EquipmentProfile = {
  name: 'Référence',
  boilKettleVolumeL: 40,
  mashTunVolumeL: null,
  targetBatchVolumeL: 23,
  boilTimeMin: 60,
  evaporationRateLPerHour: 4,
  grainAbsorptionLPerKg: 1,
  waterToGrainRatioLPerKg: 3,
  mashTunDeadspaceL: 1,
  // Perte trub 2,0 L (houblon/trub + volume mort cuve/refroidisseur, réunis dans les specs).
  hopAbsorptionL: 2,
  deadspaceL: 0,
  fermenterLossL: 0,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 75,
  hopUtilizationPercent: 100,
  method: 'all-grain',
}

const fermentables: Fermentable[] = [
  { name: 'Pale Ale', type: 'grain', amountKg: 4.8, colorLovibond: 3, yieldPercent: ppgToYield(37) },
  { name: 'Crystal 60', type: 'grain', amountKg: 0.4, colorLovibond: 60, yieldPercent: ppgToYield(34) },
  { name: 'Munich', type: 'grain', amountKg: 0.3, colorLovibond: 9, yieldPercent: ppgToYield(37) },
]

const hops: Hop[] = [
  { name: 'Magnum', amountG: 20, alphaAcidPercent: 14, timeMin: 60, use: 'boil' },
  { name: 'Cascade', amountG: 30, alphaAcidPercent: 6, timeMin: 10, use: 'boil' },
  { name: 'Citra', amountG: 50, alphaAcidPercent: 12, timeMin: 20, use: 'whirlpool', temperatureC: 80 },
]

const result = computeRecipe({
  fermentables,
  hops,
  yeasts: [{ name: 'Ale', type: 'dry', style: 'ale', attenuationPercent: 78 }],
  targetVolumeL: 23,
  boilTimeMin: 60,
  mashEfficiencyPercent: 75,
  ibuFormula: 'tinseth',
  equipment,
})

describe('cas de référence des specs — Pale Ale 23 L', () => {
  it('§1 volumes', () => {
    const v = result.volumes!
    expect(v.endOfBoilColdVolumeL).toBeCloseTo(25.0, 1)
    expect(v.postBoilVolumeL).toBeCloseTo(26.0, 1)
    expect(v.preBoilVolumeL).toBeCloseTo(30.0, 1)
    expect(v.totalWaterNeededL).toBeCloseTo(36.5, 1)
    expect(v.mashWaterL).toBeCloseTo(16.5, 1)
    expect(v.spargeWaterL).toBeCloseTo(20.0, 1)
  })

  it('§2 densités', () => {
    expect(result.preBoilGravity!).toBeCloseTo(1.042, 3)
    expect(result.og).toBeCloseTo(1.0506, 4)
    expect(result.boilGravity).toBeCloseTo(1.046, 3)
  })

  it('§3 couleur', () => {
    expect(result.srm).toBeCloseTo(9.0, 1)
    expect(result.ebc).toBeCloseTo(17.7, 1)
  })

  it('§4 amertume des specs, par ajout puis au total (sans prise en compte du hopstand)', () => {
    expect(hopstandUtilizationFactor(80)).toBeCloseTo(0.229, 3)
    const [magnum, cascade, citra] = tinsethContributions(hops, result.boilGravity, result.calculationVolumeL, {
      boilTimeMin: 60,
      hopstand: null,
    })
    expect(magnum).toBeCloseTo(26.7, 1)
    expect(cascade).toBeCloseTo(6.2, 1)
    expect(citra).toBeCloseTo(7.9, 1)
    expect(magnum + cascade + citra).toBeCloseTo(40.8, 1)
  })

  it('§4 amertume du moteur : les houblons d’ébullition continuent d’isomériser pendant le whirlpool', () => {
    // Hopstand de 20 min à 80 °C (le whirlpool Citra) : surtout sensible sur l'ajout à 10 min.
    const [magnum, cascade, citra] = result.ibuByHop
    expect(magnum).toBeCloseTo(27.0, 1)
    expect(cascade).toBeCloseTo(7.8, 1)
    expect(citra).toBeCloseTo(7.9, 1)
    expect(result.ibu).toBeCloseTo(42.8, 1)
  })

  it('§5 densité finale et alcool', () => {
    expect(result.fg).toBeCloseTo(1.011, 3)
    expect(result.abv).toBeCloseTo(5.2, 1)
  })

  it('§7 carbonatation', () => {
    expect(residualCO2Volumes(19)).toBeCloseTo(0.89, 2)
    expect(primingSugarGrams(2.4, 19, 21)).toBeCloseTo(127, 0)
  })
})
