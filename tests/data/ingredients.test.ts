import { describe, expect, it } from 'vitest'
import {
  FERMENTABLE_CATEGORIES,
  FERMENTABLE_LIBRARY,
  HOP_LIBRARY,
  HOP_ROLES,
  YEAST_FAMILIES,
  YEAST_LIBRARY,
  yeastBrand,
} from '@/data/ingredients'

const libraries = { fermentables: FERMENTABLE_LIBRARY, hops: HOP_LIBRARY, yeasts: YEAST_LIBRARY }

describe('Guide des ingrédients', () => {
  it.each(Object.entries(libraries))('%s : noms uniques, remplaçants existants et différents', (_, library) => {
    const names = library.map((item) => item.name)
    expect(new Set(names).size).toBe(names.length)
    for (const item of library) {
      for (const substitute of item.substitutes) {
        expect(names, `${item.name} → ${substitute}`).toContain(substitute)
        expect(substitute).not.toBe(item.name)
      }
    }
  })

  it('chaque catégorie, rôle et famille a des ingrédients', () => {
    for (const { id } of FERMENTABLE_CATEGORIES) expect(FERMENTABLE_LIBRARY.some((f) => f.category === id)).toBe(true)
    for (const { id } of HOP_ROLES) expect(HOP_LIBRARY.some((h) => h.role === id)).toBe(true)
    for (const { id } of YEAST_FAMILIES) expect(YEAST_LIBRARY.some((y) => y.family === id)).toBe(true)
  })

  it('levures : atténuation et températures plausibles, marque reconnue', () => {
    for (const y of YEAST_LIBRARY) {
      expect(y.attenuationPercent).toBeGreaterThanOrEqual(60)
      expect(y.attenuationPercent).toBeLessThanOrEqual(95)
      expect(y.tempC[0]).toBeLessThan(y.tempC[1])
      expect(yeastBrand(y.name), y.name).not.toBe('')
      if (y.style === 'lager') expect(y.family).toBe('lager')
    }
  })
})
