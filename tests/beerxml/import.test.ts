import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBeerXML } from '@/lib/beerxml/import'
import { resolveBjcpStyleId } from '@/lib/beerxml/mapping'
import { computeRecipe } from '@/lib/brew-calc/recipe-stats'

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'beerxml')

function loadFixture(filename: string): string {
  return readFileSync(join(FIXTURES_DIR, filename), 'utf-8')
}

describe('parseBeerXML — real Little Bock exports', () => {
  it('parses whipa.xml (White IPA) with correct fermentables, hops and yeast', () => {
    const { recipes, errors } = parseBeerXML(loadFixture('whipa.xml'))
    expect(errors).toEqual([])
    expect(recipes).toHaveLength(1)

    const recipe = recipes[0]
    expect(recipe.name).toBe('Whipa')
    expect(recipe.type).toBe('all-grain')
    expect(recipe.targetVolumeL).toBeCloseTo(13.0, 5)
    expect(recipe.boilTimeMin).toBe(75)
    expect(recipe.mashEfficiencyPercent).toBeCloseTo(72.0, 5)

    expect(recipe.fermentables).toHaveLength(2)
    expect(recipe.fermentables[0]).toMatchObject({ name: 'Malt Pale Ale', type: 'grain', amountKg: 2.2 })
    // DISPLAY_COLOR "6 EBC" -> converti en Lovibond-équivalent.
    expect(recipe.fermentables[0].colorLovibond).toBeCloseTo(6 * 0.508, 5)

    expect(recipe.hops).toHaveLength(4)
    const dryHop = recipe.hops.find((h) => h.name === 'Cascade' && h.timeMin === 7200)
    expect(dryHop?.use).toBe('dry-hop')
    const aromaHop = recipe.hops.find((h) => h.timeMin === 30)
    expect(aromaHop?.use).toBe('boil')

    expect(recipe.yeasts).toHaveLength(1)
    expect(recipe.yeasts[0]).toMatchObject({ name: 'Safbrew Wheat', type: 'dry' })

    // Accents décodés correctement malgré l'encodage ISO-8859-1 déclaré
    // (entités numériques HTML dans le fichier source).
    expect(recipe.fermentables[1].name).toBe('Malt Froment Blanc')

    expect(recipe.sourceEstimates.og).toBeCloseTo(1.061, 5)

    const resolvedStyleId = resolveBjcpStyleId(recipe.style)
    expect(resolvedStyleId).toBe('21-specialty-ipa-white-ipa')
  })

  it('parses barley_wine, brune_forte and rye_irish_red_ale without errors', () => {
    for (const file of ['barley_wine__ma_recette_.xml', 'brune_forte.xml', 'rye_irish_red_ale.xml']) {
      const { recipes, errors } = parseBeerXML(loadFixture(file))
      expect(errors, `errors parsing ${file}`).toEqual([])
      expect(recipes).toHaveLength(1)
      expect(recipes[0].fermentables.length).toBeGreaterThan(0)
      expect(recipes[0].hops.length).toBeGreaterThan(0)
      expect(recipes[0].yeasts.length).toBeGreaterThan(0)
    }
  })

  it('decodes special characters (é, â, ®) from numeric HTML entities', () => {
    const { recipes } = parseBeerXML(loadFixture('barley_wine__ma_recette_.xml'))
    const names = recipes[0].fermentables.map((f) => f.name)
    expect(names).toContain('Malt Orge Torréfié (Roasted Barley)')
    expect(names.some((n) => n.includes('Château') || n === 'MALT CARA AMBRA®')).toBe(true)
  })

  it('resolves BJCP styles for all 4 real recipes by category/letter', () => {
    const files = [
      { file: 'barley_wine__ma_recette_.xml', expectedId: '17d-english-barley-wine' },
      { file: 'brune_forte.xml', expectedId: '26d-belgian-dark-strong-ale' },
      { file: 'rye_irish_red_ale.xml', expectedId: '15a-irish-red-ale' },
    ]
    for (const { file, expectedId } of files) {
      const { recipes } = parseBeerXML(loadFixture(file))
      expect(resolveBjcpStyleId(recipes[0].style), file).toBe(expectedId)
    }
  })

  it('cross-checks our OG calculation against the recipe’s own EST_OG for all 4 files (within 1%, allowing for rounding/PPG table differences between software)', () => {
    for (const file of ['whipa.xml', 'barley_wine__ma_recette_.xml', 'brune_forte.xml', 'rye_irish_red_ale.xml']) {
      const { recipes } = parseBeerXML(loadFixture(file))
      const recipe = recipes[0]
      const computedOG = computeRecipe({
        fermentables: recipe.fermentables,
        hops: [],
        yeasts: [],
        targetVolumeL: recipe.targetVolumeL,
        mashEfficiencyPercent: recipe.mashEfficiencyPercent,
        ibuFormula: 'tinseth',
      }).og
      const expectedOG = recipe.sourceEstimates.og!
      expect(Math.abs(computedOG - expectedOG), file).toBeLessThan(0.01)
    }
  })

  it('returns a descriptive error for malformed XML instead of throwing', () => {
    const { recipes, errors } = parseBeerXML('<not-beerxml></not-beerxml>')
    expect(recipes).toEqual([])
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('parseBeerXML — entités numériques', () => {
  const xml = (name: string) =>
    `<RECIPES><RECIPE><NAME>${name}</NAME><VERSION>1</VERSION><TYPE>All Grain</TYPE><BATCH_SIZE>10</BATCH_SIZE><BOIL_TIME>60</BOIL_TIME><EFFICIENCY>72</EFFICIENCY><FERMENTABLES></FERMENTABLES><HOPS></HOPS><YEASTS></YEASTS></RECIPE></RECIPES>`

  it('décode les accents', () => {
    expect(parseBeerXML(xml('Blonde d&#233;go&#xFB;t&#233;e')).recipes[0].name).toBe('Blonde dégoûtée')
  })

  it('garde & et < littéraux sans casser le XML', () => {
    const { recipes, errors } = parseBeerXML(xml('Brune &#38; Blonde &#60;2&#62;'))
    expect(errors).toEqual([])
    expect(recipes[0].name).toBe('Brune & Blonde <2>')
  })

  it('ne plante pas sur un point de code invalide', () => {
    const { recipes, errors } = parseBeerXML(xml('Bizarre &#99999999;'))
    expect(() => parseBeerXML(xml('x &#xFFFFFFFF;'))).not.toThrow()
    expect(errors.length + recipes.length).toBeGreaterThan(0)
  })
})

describe('parseBeerXML — volume de brassin invalide', () => {
  const xml = (batchSize: string) =>
    `<RECIPES><RECIPE><NAME>Sans volume</NAME><VERSION>1</VERSION><TYPE>All Grain</TYPE>${batchSize}<BOIL_TIME>60</BOIL_TIME><EFFICIENCY>72</EFFICIENCY><FERMENTABLES></FERMENTABLES><HOPS></HOPS><YEASTS></YEASTS></RECIPE></RECIPES>`

  it.each([['absent', ''], ['nul', '<BATCH_SIZE>0</BATCH_SIZE>'], ['négatif', '<BATCH_SIZE>-3</BATCH_SIZE>']])(
    'rejette la recette quand BATCH_SIZE est %s, avec un message clair',
    (_label, tag) => {
      const { recipes, errors } = parseBeerXML(xml(tag))
      expect(recipes).toEqual([])
      expect(errors).toHaveLength(1)
      expect(errors[0].recipeName).toBe('Sans volume')
      expect(errors[0].message).toMatch(/BATCH_SIZE/)
    },
  )
})
