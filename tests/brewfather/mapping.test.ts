import { describe, expect, it } from 'vitest'
import { compareWithBrewfather } from '@/lib/brewfather/compare'
import { brewfatherEquipmentToProfile, brewfatherRecipeToDraft, kettleVolumeFromName } from '@/lib/brewfather/mapping'
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
  // IBU de notre moteur (hopstand compris) : cônes, donc sans bonus pellets.
  ibu: 42.8,
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
    { name: 'Magnum', amount: 20, alpha: 14, time: 60, use: 'Boil', type: 'Leaf' },
    { name: 'Cascade', amount: 30, alpha: 6, time: 10, use: 'Boil', type: 'Leaf' },
    { name: 'Citra', amount: 50, alpha: 12, time: 20, use: 'Aroma', type: 'Leaf' },
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

describe('brewfatherRecipeToDraft — fermentation, levure, carbonatation', () => {
  // Forme réelle de l'API v2 (recette anonymisée).
  const draft = brewfatherRecipeToDraft({
    ...paleAle,
    carbonation: 2.4,
    fermentation: {
      name: 'Ale',
      steps: [
        { type: 'Primary', name: 'Fermentation', stepTemp: 18, stepTime: 14 },
        { type: 'Conditioning', name: 'Cold crash', stepTemp: 2, stepTime: 3 },
        { type: 'Conditioning', name: 'Garde', stepTemp: 12, stepTime: 46 },
        { type: 'Secondary', stepTemp: 5, stepTime: 10 },
      ],
    },
    hops: [{ name: 'Citra', amount: 40, alpha: 12, use: 'Dry Hop', time: 5, day: 9 }],
    yeasts: [
      { name: 'Wheat', form: 'Dry', amount: 11, unit: 'g' },
      { name: 'M44', form: 'Dry', amount: 1.1, unit: 'pkg' },
    ],
  })

  it('reprend le profil de fermentation (le nom précise le type)', () => {
    expect(draft.fermentationSteps).toEqual([
      { type: 'primary', tempC: 18, days: 14 },
      { type: 'cold-crash', tempC: 2, days: 3 },
      { type: 'conditioning', tempC: 12, days: 46 },
      { type: 'secondary', tempC: 5, days: 10 },
    ])
    expect(draft.carbonationVols).toBe(2.4)
  })

  it('reprend le jour du dry hop et la quantité de levure', () => {
    expect(draft.hops[0]).toMatchObject({ use: 'dry-hop', dryHopDays: 5, dryHopDay: 9 })
    expect(draft.yeasts.map((y) => [y.amount, y.amountUnit])).toEqual([
      [11, 'g'],
      [1.1, 'pkg'],
    ])
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

  it('nomme un équipement « Imported » d’après sa recette, et estime la cuve faute de capacité', () => {
    // Brune forte : Brewfather ne donne que le volume pré-ébullition (15,9 L), pas la taille de la cuve.
    const profile = brewfatherEquipmentToProfile({
      ...paleAle,
      name: 'Brune forte',
      equipment: { name: 'Imported', batchSize: 12, boilSize: 15.9, boilTime: 60, boilOffPerHr: 2.879 },
    })
    expect(profile?.name).toBe('Équipement de « Brune forte »')
    expect(profile?.boilKettleVolumeL).toBe(20)
    expect(profile?.evaporationRateLPerHour).toBe(2.879)
  })

  it('lit la capacité de la cuve dans le nom de l’équipement', () => {
    const profile = brewfatherEquipmentToProfile({ ...paleAle, equipment: { name: 'Marmite 20L', batchSize: 14, boilSize: 19.3 } })
    expect(profile?.name).toBe('Marmite 20L')
    expect(profile?.boilKettleVolumeL).toBe(20)
    expect(kettleVolumeFromName('Cuve 35 litres')).toBe(35)
    expect(kettleVolumeFromName('Imported')).toBeUndefined()
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
