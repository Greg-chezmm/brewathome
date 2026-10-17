import { describe, expect, it } from 'vitest'
import { STARTER_RECIPE } from '@/data/starter-recipe'
import { beerXMLFileName, recipesToBeerXML } from '@/lib/beerxml/export'
import { parseBeerXML } from '@/lib/beerxml/import'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const recipe: RecipeDetails = {
  ...STARTER_RECIPE,
  id: 'r1',
  name: 'Pale Ale « test » & co',
  status: 'validated',
  estOg: 1.052,
  estFg: 1.012,
  estIbu: 38,
  estSrm: 7,
  estAbv: 5.2,
  createdAt: '2026-10-01',
  fermentables: [
    ...STARTER_RECIPE.fermentables,
    { name: 'Dextrose', type: 'sugar', amountKg: 0.2, colorLovibond: 0, yieldPercent: 91, use: 'fermentation' },
  ],
}

describe('export BeerXML', () => {
  const xml = recipesToBeerXML([recipe], { boilVolumeL: 26.5 })
  const [back] = parseBeerXML(xml).recipes

  it('produit un BeerXML que notre import relit sans erreur', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('Pale Ale « test » &amp; co')
    expect(parseBeerXML(xml).errors).toEqual([])
    expect(back).toMatchObject({ name: recipe.name, type: 'all-grain', targetVolumeL: 20, boilVolumeL: 26.5, boilTimeMin: 60, mashEfficiencyPercent: 72 })
  })

  it('garde les ingrédients, le style et l’empâtage', () => {
    expect(back.fermentables.map((f) => [f.name, f.amountKg, f.type])).toEqual(recipe.fermentables.map((f) => [f.name, f.amountKg, f.type]))
    expect(back.fermentables[3].use).toBe('fermentation')
    expect(back.hops.map((h) => [h.name, h.amountG, h.alphaAcidPercent])).toEqual(recipe.hops.map((h) => [h.name, h.amountG, h.alphaAcidPercent]))
    expect(back.hops[3]).toMatchObject({ use: 'dry-hop', dryHopDays: 4 })
    expect(back.mashSteps).toEqual(recipe.mashSteps)
    expect(back.style).toMatchObject({ name: 'American Pale Ale', categoryNumber: '18', styleLetter: 'B' })
    expect(back.otherIngredients).toEqual([{ name: 'Whirlfloc', amount: '1 pastille', timeMin: 10 }])
  })

  it('garde levure (sachets), fermentation et carbonatation', () => {
    expect(back.yeasts[0]).toMatchObject({ name: 'SafAle US-05', type: 'dry', attenuationPercent: 78, amount: 1, amountUnit: 'pkg' })
    expect(back.fermentationSteps).toEqual([
      { type: 'primary', tempC: 18, days: 12 },
      { type: 'cold-crash', tempC: 2, days: 2 },
    ])
    expect(back.carbonationVols).toBe(2.4)
    expect(back.sourceEstimates).toMatchObject({ og: 1.052, fg: 1.012, ibu: 38, abv: 5.2 })
  })

  it('nom de fichier sans accents ni espaces', () => {
    expect(beerXMLFileName('Ma première Pale Ale !')).toBe('ma-premiere-pale-ale.xml')
    expect(beerXMLFileName('***')).toBe('recette.xml')
  })
})
