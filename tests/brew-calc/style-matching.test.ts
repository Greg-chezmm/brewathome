import { describe, expect, it } from 'vitest'
import { matchStyle } from '@/lib/brew-calc/style-matching'
import type { BJCPStyleRanges, RecipeStats } from '@/lib/brew-calc/types'

const whiteIpaStyle: BJCPStyleRanges = {
  og: { min: 1.056, max: 1.065 },
  fg: { min: 1.01, max: 1.016 },
  ibu: { min: 40, max: 70 },
  srm: { min: 9, max: 15 },
  abv: { min: 5.5, max: 7.0 },
}

describe('matchStyle', () => {
  it('matches when all stats are within range', () => {
    const stats: RecipeStats = { og: 1.061, fg: 1.01, ibu: 42, srm: 10, abv: 6.7 }
    const result = matchStyle(stats, whiteIpaStyle)
    expect(result.allMatch).toBe(true)
    expect(result.og).toBe(true)
    expect(result.ibu).toBe(true)
  })

  it('flags out-of-range criteria individually without failing the others', () => {
    const stats: RecipeStats = { og: 1.061, fg: 1.01, ibu: 20, srm: 10, abv: 6.7 }
    const result = matchStyle(stats, whiteIpaStyle)
    expect(result.ibu).toBe(false)
    expect(result.og).toBe(true)
    expect(result.allMatch).toBe(false)
  })

  it('treats range boundaries as inclusive', () => {
    const stats: RecipeStats = { og: 1.056, fg: 1.016, ibu: 40, srm: 9, abv: 5.5 }
    const result = matchStyle(stats, whiteIpaStyle)
    expect(result.allMatch).toBe(true)
  })
})
