import { describe, expect, it } from 'vitest'
import { averageRating, newTasting, normalizeTastings } from '@/lib/batches/tastings'

describe('normalizeTastings', () => {
  it('rend une liste vide pour tout ce qui n’est pas un tableau', () => {
    expect(normalizeTastings(null)).toEqual([])
    expect(normalizeTastings(undefined)).toEqual([])
    expect(normalizeTastings({ a: 1 })).toEqual([])
    expect(normalizeTastings('x')).toEqual([])
  })

  it('complète les champs manquants et garde ce qui est valide', () => {
    expect(normalizeTastings([{ id: 't1', date: '2026-11-02', rating: 4, aroma: 'agrumes' }])).toEqual([
      { id: 't1', date: '2026-11-02', rating: 4, appearance: '', aroma: 'agrumes', taste: '', changeNext: '' },
    ])
  })

  it.each([[0], [6], [-1], [Number.NaN], ['beaucoup'], [null]])('ignore la note %s (hors 1 à 5)', (rating) => {
    expect(normalizeTastings([{ id: 't', date: '2026-11-02', rating }])[0].rating).toBeNull()
  })

  it('arrondit la note à l’entier', () => {
    expect(normalizeTastings([{ id: 't', date: '2026-11-02', rating: 3.6 }])[0].rating).toBe(4)
  })

  it('écarte les entrées sans date valide ou sans identifiant', () => {
    expect(
      normalizeTastings([{ id: 't1', date: 'hier' }, { date: '2026-11-02' }, 42, null, { id: 't2', date: '2026-11-02' }]).map((t) => t.id),
    ).toEqual(['t2'])
  })

  it('trie du plus récent au plus ancien', () => {
    const list = normalizeTastings([
      { id: 'a', date: '2026-11-02' },
      { id: 'b', date: '2026-12-20' },
      { id: 'c', date: '2026-11-30' },
    ])
    expect(list.map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('newTasting', () => {
  it('démarre à la date du jour, sans note ni texte', () => {
    expect(newTasting('2026-11-02', 'id1')).toEqual({
      id: 'id1',
      date: '2026-11-02',
      rating: null,
      appearance: '',
      aroma: '',
      taste: '',
      changeNext: '',
    })
  })
})

describe('averageRating', () => {
  it('moyenne des notes données, à une décimale', () => {
    const t = (rating: number | null) => ({ ...newTasting('2026-11-02', 'x'), rating })
    expect(averageRating([t(4), t(5), t(null), t(4)])).toBe(4.3)
  })

  it('null sans aucune note', () => {
    expect(averageRating([])).toBeNull()
    expect(averageRating([{ ...newTasting('2026-11-02', 'x'), rating: null }])).toBeNull()
  })
})
