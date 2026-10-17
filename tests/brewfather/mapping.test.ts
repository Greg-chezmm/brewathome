import { describe, expect, it } from 'vitest'
import { compareWithBrewfather } from '@/lib/brewfather/compare'
import { brewfatherEquipmentToProfile, brewfatherRecipeToDraft } from '@/lib/brewfather/mapping'
import type { BrewfatherRecipe } from '@/lib/brewfather/types'

/** Le cas de référence des specs (Pale Ale 23 L), tel que le renverrait l'API Brewfather. */
const paleAle: BrewfatherRecipe = {
  _id: 'abc',
  name: 'Pale Ale référence',
  type: 'All Grain',
  batchSize: 23,
  boilSize: 30,
  boilTime: 60,
  efficiency: 70,
  mashEfficiency: 75,
  og: 1.0506,
  fg: 1.011,
  ibu: 40.8,
  color: 9,
  abv: 5.2,
  style: { name: 'American Pale Ale', categoryNumber: 18, styleLetter: 'B', styleGuide: 'BJCP 2021' },
  equipment: {
    name: 'Référence',
    batchSize: 23,
    boilTime: 60,
    boilOffPerHr: 4,
    grainAbsorptionRate: 1,
    waterGrainRatio: 3,
    mashTunDeadSpace: 1,
    trubChillerLoss: 2,
    fermenterLoss: 0,
    coolingShrinkage: 4,
    hopUtilization: 100,
    hopstandTemperature: 80,
    mashEfficiency: 75,
  },
  fermentables: [
    { name: 'Pale Ale', type: 'Grain', amount: 4.8, color: 3, potential: 1.037 },
    { name: 'Crystal 60', type: 'Grain', amount: 0.4, color: 60, potential: 1.034 },
    { name: 'Munich', type: 'Grain', amount: 0.3, color: 9, potential: 1.037 },
  ],
  hops: [
    { name: 'Magnum', amount: 20, alpha: 14, time: 60, use: 'Boil', type: 'Pellet' },
    { name: 'Cascade', amount: 30, alpha: 6, time: 10, use: 'Boil', type: 'Pellet' },
    { name: 'Citra', amount: 50, alpha: 12, time: 20, use: 'Aroma', type: 'Pellet' },
    { name: 'Citra', amount: 100, alpha: 12, time: 4, use: 'Dry Hop', type: 'Pellet' },
  ],
  yeasts: [{ name: 'US-05', type: 'Ale', form: 'Dry', attenuation: 78 }],
  miscs: [
    { name: 'Whirlfloc', amount: 1, unit: 'items', use: 'Boil', time: 10 },
    { name: 'Gypse', amount: 5, unit: 'g', use: 'Mash', time: 60 },
  ],
  mash: { steps: [{ stepTemp: 67, stepTime: 60 }, { stepTemp: 76, stepTime: 10 }] },
}

describe('brewfatherRecipeToDraft', () => {
  const draft = brewfatherRecipeToDraft(paleAle)

  it('reprend volumes, efficacité d’empâtage et palier principal', () => {
    expect(draft.type).toBe('all-grain')
    expect(draft.targetVolumeL).toBe(23)
    expect(draft.mashEfficiencyPercent).toBe(75)
    expect(draft.mashTempC).toBe(67)
    expect(draft.style).toMatchObject({ name: 'American Pale Ale', categoryNumber: '18', styleLetter: 'B' })
  })

  it('déduit le rendement de la densité potentielle', () => {
    expect(draft.fermentables[0].yieldPercent).toBeCloseTo((37 / 46) * 100, 6)
  })

  it('traduit les usages de houblon (Aroma = whirlpool, Dry Hop en jours)', () => {
    expect(draft.hops.map((h) => h.use)).toEqual(['boil', 'boil', 'whirlpool', 'dry-hop'])
    expect(draft.hops[2].temperatureC).toBe(80)
    expect(draft.hops[3]).toMatchObject({ timeMin: 0, dryHopDays: 4 })
  })

  it('ne garde que les divers ajoutés en ébullition', () => {
    expect(draft.otherIngredients).toEqual([{ name: 'Whirlfloc', amount: '1 items', timeMin: 10 }])
  })

  it('convertit la levure', () => {
    expect(draft.yeasts[0]).toEqual({ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 78 })
  })
})

describe('brewfatherEquipmentToProfile', () => {
  it('accepte une contraction exprimée en fraction', () => {
    const profile = brewfatherEquipmentToProfile({ ...paleAle, equipment: { ...paleAle.equipment, coolingShrinkage: 0.04 } })
    expect(profile?.thermalShrinkagePercent).toBeCloseTo(4, 6)
  })

  it('renvoie null sans équipement', () => {
    expect(brewfatherEquipmentToProfile({ ...paleAle, equipment: null })).toBeNull()
  })
})

describe('compareWithBrewfather', () => {
  it('retrouve les valeurs du cas de référence', () => {
    const { rows } = compareWithBrewfather(paleAle)
    expect(rows.map((r) => r.key)).toEqual(['og', 'fg', 'abv', 'ibu', 'srm', 'preBoilVolume'])
    for (const row of rows) expect(row.ok, `${row.label} : ${row.ours} vs ${row.brewfather}`).toBe(true)
  })

  it('signale un écart notable', () => {
    const { rows } = compareWithBrewfather({ ...paleAle, ibu: 55 })
    expect(rows.find((r) => r.key === 'ibu')?.ok).toBe(false)
  })
})
