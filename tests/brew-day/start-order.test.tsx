import { describe, expect, it } from 'vitest'
import { startBlocker } from '@/lib/brew-day/order'
import type { BatchStep } from '@/lib/db/queries/batches'

let n = 0
function mk(over: Partial<BatchStep>): BatchStep {
  n += 1
  return { id: `s${n}`, orderIndex: n, label: `Étape ${n}`, status: 'todo', session: null, stepType: 'mash', ...over } as BatchStep
}

describe('Démarrer une étape : les précédentes doivent être finies', () => {
  it('bloque l’ébullition tant que l’empâtage n’est pas terminé', () => {
    const mash = mk({ label: 'Empâtage', status: 'in-progress' })
    const boil = mk({ label: 'Ébullition', stepType: 'boil' })
    expect(startBlocker([mash, boil], boil)?.label).toBe('Empâtage')
  })

  it('autorise le démarrage quand toutes les précédentes sont terminées ou passées', () => {
    const a = mk({ status: 'done' })
    const b = mk({ status: 'skipped' })
    const c = mk({})
    expect(startBlocker([a, b, c], c)).toBeNull()
  })

  it('ne tient pas compte des étapes suivantes', () => {
    const a = mk({})
    const b = mk({})
    expect(startBlocker([a, b], a)).toBeNull()
  })

  it('rapporte la première étape en attente, dans l’ordre', () => {
    const a = mk({ label: 'Première' })
    const b = mk({ label: 'Deuxième' })
    const c = mk({})
    expect(startBlocker([c, b, a], c)?.label).toBe('Première')
  })

  it('2 sessions : la session 2 n’attend pas la session 1, mais attend les étapes communes', () => {
    const common = mk({ label: 'Préparation', status: 'done' })
    const s1 = mk({ label: 'Empâtage S1', session: 1, status: 'in-progress' })
    const s2 = mk({ label: 'Empâtage S2', session: 2 })
    expect(startBlocker([common, s1, s2], s2)).toBeNull()
    const pending = mk({ label: 'Eau', session: null, orderIndex: 0 })
    expect(startBlocker([pending, s1, s2], s2)?.label).toBe('Eau')
  })

  it('une étape commune attend toutes les sessions', () => {
    const s1 = mk({ label: 'Ébullition S1', session: 1, status: 'done' })
    const s2 = mk({ label: 'Ébullition S2', session: 2, status: 'in-progress' })
    const pitch = mk({ label: 'Ensemencement', stepType: 'pitch' })
    expect(startBlocker([s1, s2, pitch], pitch)?.label).toBe('Ébullition S2')
  })
})
