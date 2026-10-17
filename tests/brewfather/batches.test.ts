import { afterEach, describe, expect, it } from 'vitest'
import batches from '../fixtures/brewfather/recent-batches.json'
import {
  apparentAttenuation,
  brewfatherBatchToImport,
  efficiencyPerformance,
  yeastPerformance,
} from '@/lib/brewfather/batches'
import type { BrewfatherBatch } from '@/lib/brewfather/types'

/** Brassins Brewfather réels (les 6 plus récents du compte, réduits aux mesures et à la recette). */
const fixture = batches as BrewfatherBatch[]
const [whipa, , barleyWine, , , planned] = fixture

describe('brewfatherBatchToImport', () => {
  const initialTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = initialTz
  })

  it('reprend les mesures au densimètre et le volume en fermenteur', () => {
    expect(brewfatherBatchToImport(barleyWine)).toMatchObject({
      brewfatherId: 'brassin-3',
      name: 'Barley wine ( Ma recette ) #31',
      status: 'completed',
      ogMeasured: 1.105,
      fgMeasured: 1.017,
      volumeMeasuredL: 10.8,
    })
  })

  it('date le brassage dans le fuseau du brasseur (Brewfather stocke minuit local)', () => {
    process.env.TZ = 'Europe/Paris'
    // 2025-10-24T22:00Z : minuit le 25 à Paris.
    expect(brewfatherBatchToImport(whipa).brewDate).toBe('2025-10-25')
  })

  it('archivé = terminé, sans mesure = null', () => {
    const imported = brewfatherBatchToImport(planned)
    expect(imported.status).toBe('completed')
    expect(imported.ogMeasured).toBeNull()
    expect(imported.fgMeasured).toBeNull()
  })

  it('traduit les statuts en cours', () => {
    const status = (s: string) => brewfatherBatchToImport({ ...whipa, status: s }).status
    expect(['Planning', 'Brewing', 'Fermenting', 'Conditioning'].map(status)).toEqual([
      'planned',
      'brew_day',
      'fermentation',
      'conditioning',
    ])
  })

  it('le snapshot est la recette du brassin, nommée comme lui', () => {
    const { draft, equipment } = brewfatherBatchToImport(barleyWine)
    expect(draft?.name).toBe('Barley wine ( Ma recette ) #31')
    expect(draft?.fermentables.length).toBe(barleyWine.recipe!.fermentables!.length)
    expect(equipment?.name).toBe(barleyWine.recipe!.equipment!.name)
  })

  it('sans recette, rien à importer', () => {
    expect(brewfatherBatchToImport({ ...whipa, recipe: null }).draft).toBeNull()
  })
})

describe('performances réelles', () => {
  it('atténuation apparente', () => {
    expect(apparentAttenuation(1.05, 1.01)).toBeCloseTo(80, 6)
  })

  it('atténuation par levure, uniquement sur DI et DF mesurées', () => {
    const yeasts = yeastPerformance(fixture)
    const wheat = yeasts.find((y) => y.yeast === 'Safbrew Wheat')!
    // Whipa ×2 (88,2 % et 88,0 %) et hibiscus (87,3 %) ; la fiche annonce 85 %.
    expect(wheat.batches).toBe(3)
    expect(wheat.announcedPercent).toBe(85)
    expect(wheat.measuredPercent).toBeCloseTo(87.8, 1)
    // Le brassin sans mesure de la Tripel n'est pas compté.
    expect(yeasts.find((y) => y.yeast === 'Belgian Tripel')?.batches).toBe(1)
  })

  it('rendement d’empâtage réel contre prévu, brassins sans DI exclus', () => {
    const efficiency = efficiencyPerformance(fixture)!
    expect(efficiency.batches).toBe(5)
    expect(efficiency.measuredPercent).toBeCloseTo((62.73 + 57.03 + 52.93 + 58.55 + 57.05) / 5, 6)
    expect(efficiency.plannedPercent).toBeCloseTo((71.1 + 71.1 + 75 + 77.1 + 77.8) / 5, 6)
  })
})
