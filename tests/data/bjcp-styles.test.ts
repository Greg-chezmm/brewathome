import { describe, expect, it } from 'vitest'
import styles from '@/data/bjcp-styles-2021.json'

describe('bjcp-styles-2021.json', () => {
  it('contains a substantial number of BJCP 2021 styles', () => {
    expect(styles.length).toBeGreaterThan(100)
  })

  it('has unique ids', () => {
    const ids = styles.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has coherent min/max ranges for every style', () => {
    for (const s of styles) {
      expect(s.ogMin).toBeLessThanOrEqual(s.ogMax)
      expect(s.fgMin).toBeLessThanOrEqual(s.fgMax)
      expect(s.ibuMin).toBeLessThanOrEqual(s.ibuMax)
      expect(s.srmMin).toBeLessThanOrEqual(s.srmMax)
      expect(s.abvMin).toBeLessThanOrEqual(s.abvMax)
    }
  })

  it('includes the styles matching the user’s existing recipes', () => {
    const names = styles.map((s) => s.name.toLowerCase())
    expect(names.some((n) => n.includes('white ipa'))).toBe(true)
    expect(names.some((n) => n.includes('barleywine') || n.includes('barley wine'))).toBe(true)
    expect(names.some((n) => n.includes('irish red ale'))).toBe(true)
  })
})
