import { describe, expect, it } from 'vitest'
import { computeVersion, formatBuildInfo } from '@/lib/version'

describe('formatBuildInfo', () => {
  it('affiche la version, le commit court et la date du build en français', () => {
    const text = formatBuildInfo({ version: '0.1.0', commit: '3313fa9d2c1e', builtAt: '2026-10-24T15:47:00.000Z' }, 'Europe/Paris')
    expect(text).toBe('v0.1.0 · 3313fa9 · 24/10/2026 17:47')
  })

  it('reste lisible sans commit connu (build hors dépôt git)', () => {
    expect(formatBuildInfo({ version: '0.1.0', commit: '', builtAt: '2026-10-24T15:47:00.000Z' }, 'Europe/Paris')).toBe(
      'v0.1.0 · 24/10/2026 17:47',
    )
  })

  it('ne plante pas sur une date invalide', () => {
    expect(formatBuildInfo({ version: '0.1.0', commit: 'abcdef1', builtAt: 'n’importe quoi' }, 'Europe/Paris')).toBe('v0.1.0 · abcdef1')
  })
})

describe('computeVersion', () => {
  it('donne 1.0.<nombre de commits>', () => {
    expect(computeVersion('1.0.0', 131)).toBe('1.0.131')
  })

  it('garde le majeur.mineur du package.json et remplace le correctif', () => {
    expect(computeVersion('2.3.7', 42)).toBe('2.3.42')
  })

  it('retombe sur la version du package.json sans décompte (hors git, ou clone tronqué)', () => {
    expect(computeVersion('1.0.0', null)).toBe('1.0.0')
    expect(computeVersion('1.0.0', 0)).toBe('1.0.0')
    expect(computeVersion('1.0.0', Number.NaN)).toBe('1.0.0')
  })
})
