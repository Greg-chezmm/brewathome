import { describe, expect, it } from 'vitest'
import { DEFAULT_CONDITIONING_DAYS, daysUntilReady, readyDate, readyLabel } from '@/lib/batches/conditioning'

describe('readyDate', () => {
  it('ajoute 21 jours par défaut', () => {
    expect(DEFAULT_CONDITIONING_DAYS).toBe(21)
    expect(readyDate('2026-10-24')).toBe('2026-11-14')
  })

  it('passe les fins de mois et d’année, années bissextiles comprises', () => {
    expect(readyDate('2026-12-20', 21)).toBe('2027-01-10')
    expect(readyDate('2028-02-20', 10)).toBe('2028-03-01')
    expect(readyDate('2026-02-20', 10)).toBe('2026-03-02')
  })

  it('accepte une durée personnalisée', () => {
    expect(readyDate('2026-10-24', 14)).toBe('2026-11-07')
  })

  it('rend null sans date valide', () => {
    expect(readyDate('')).toBeNull()
    expect(readyDate('pas une date')).toBeNull()
    expect(readyDate(null)).toBeNull()
  })

  it.each([0, -3, Number.NaN])('retombe sur la durée par défaut pour %s jours', (days) => {
    expect(readyDate('2026-10-24', days)).toBe('2026-11-14')
  })
})

describe('daysUntilReady', () => {
  it('compte les jours restants, négatif une fois la date passée', () => {
    expect(daysUntilReady('2026-11-14', '2026-11-09')).toBe(5)
    expect(daysUntilReady('2026-11-14', '2026-11-14')).toBe(0)
    expect(daysUntilReady('2026-11-14', '2026-11-17')).toBe(-3)
  })

  it('ne dérive pas au changement d’heure', () => {
    expect(daysUntilReady('2026-11-01', '2026-10-24')).toBe(8)
  })
})

describe('readyLabel', () => {
  it('annonce dans combien de temps, avec la date en français', () => {
    expect(readyLabel('2026-10-24', 21, '2026-11-09')).toBe('Prête à boire dans 5 jours (14/11/2026)')
  })

  it('dit demain', () => {
    expect(readyLabel('2026-10-24', 21, '2026-11-13')).toBe('Prête à boire demain (14/11/2026)')
  })

  it('dit aujourd’hui', () => {
    expect(readyLabel('2026-10-24', 21, '2026-11-14')).toBe('Prête à boire aujourd’hui (14/11/2026)')
  })

  it('dit depuis combien de temps elle est prête', () => {
    expect(readyLabel('2026-10-24', 21, '2026-11-17')).toBe('Prête à boire depuis 3 jours (14/11/2026)')
    expect(readyLabel('2026-10-24', 21, '2026-11-15')).toBe('Prête à boire depuis 1 jour (14/11/2026)')
  })

  it('rend null sans date d’embouteillage', () => {
    expect(readyLabel(null, 21, '2026-11-09')).toBeNull()
  })
})
