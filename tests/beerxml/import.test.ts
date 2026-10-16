import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBeerXML } from '@/lib/beerxml/import'
import { resolveBjcpStyleId } from '@/lib/beerxml/mapping'
import { calculateOG } from '@/lib/brew-calc/gravity'

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
      const computedOG = calculateOG(recipe.fermentables, recipe.targetVolumeL, recipe.mashEfficiencyPercent)
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
