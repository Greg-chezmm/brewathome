import { describe, expect, it } from 'vitest'
import { costRows, costSummary, normalizeCosts, serializeCosts } from '@/lib/batches/costs'

const recipe = {
  fermentables: [
    { name: 'Pale', type: 'grain' as const, amountKg: 2, colorLovibond: 3, yieldPercent: 80 },
    { name: 'Sucre candi', type: 'sugar' as const, amountKg: 0.3, colorLovibond: 1, yieldPercent: 100 },
  ],
  hops: [
    { name: 'Citra', amountG: 20, alphaAcidPercent: 12, timeMin: 10, use: 'boil' as const },
    { name: 'Citra', amountG: 30, alphaAcidPercent: 12, timeMin: 0, use: 'dry-hop' as const },
  ],
  yeasts: [{ name: 'US-05', type: 'dry' as const, style: 'ale' as const, attenuationPercent: 80 }],
  otherIngredients: [{ name: 'Whirlfloc', amount: '1 tablette', timeMin: 10 }],
}

describe('normalizeCosts', () => {
  it('tolère tout ce qui n’est pas un tableau', () => {
    expect(normalizeCosts(null)).toEqual([])
    expect(normalizeCosts({ a: 1 })).toEqual([])
  })

  it('garde les lignes valides et écarte les autres', () => {
    expect(
      normalizeCosts([{ label: 'Pale', amount: 4.2 }, { label: '', amount: 3 }, { label: 'X', amount: -2 }, { label: 'Y', amount: 'abc' }, 7, null]),
    ).toEqual([{ label: 'Pale', amount: 4.2 }])
  })
})

describe('costRows', () => {
  it('une ligne par ingrédient de la recette du brassin, avec sa quantité, sans prix tant que rien n’est saisi', () => {
    const rows = costRows(recipe, [])
    expect(rows.map((r) => [r.label, r.detail, r.amount, r.extra])).toEqual([
      ['Pale', '2 kg', null, false],
      ['Sucre candi', '300 g', null, false],
      ['Citra', '20 g', null, false],
      ['Citra (2)', '30 g', null, false],
      ['US-05', '', null, false],
      ['Whirlfloc', '1 tablette', null, false],
    ])
  })

  it('reprend les prix enregistrés par libellé', () => {
    const rows = costRows(recipe, [{ label: 'Pale', amount: 4.2 }, { label: 'Citra (2)', amount: 3 }])
    expect(rows.find((r) => r.label === 'Pale')!.amount).toBe(4.2)
    expect(rows.find((r) => r.label === 'Citra (2)')!.amount).toBe(3)
    expect(rows.find((r) => r.label === 'US-05')!.amount).toBeNull()
  })

  it('garde en lignes libres les frais enregistrés qui ne sont pas des ingrédients (bouteilles, gaz…)', () => {
    const rows = costRows(recipe, [{ label: 'Capsules', amount: 2.5 }])
    expect(rows.filter((r) => r.extra)).toEqual([{ label: 'Capsules', detail: '', amount: 2.5, extra: true }])
    expect(rows[rows.length - 1].label).toBe('Capsules')
  })

  it('un prix enregistré pour un ingrédient retiré de la recette reste visible (ligne libre)', () => {
    const rows = costRows({ ...recipe, hops: [] }, [{ label: 'Citra', amount: 6 }])
    expect(rows.find((r) => r.label === 'Citra')).toMatchObject({ extra: true, amount: 6 })
  })
})

describe('serializeCosts', () => {
  it('n’enregistre que les lignes chiffrées', () => {
    expect(
      serializeCosts([
        { label: 'Pale', detail: '2 kg', amount: 4.2, extra: false },
        { label: 'US-05', detail: '', amount: null, extra: false },
        { label: ' Capsules ', detail: '', amount: 2.5, extra: true },
        { label: '', detail: '', amount: 3, extra: true },
        { label: 'Gaz', detail: '', amount: -1, extra: true },
      ]),
    ).toEqual([
      { label: 'Pale', amount: 4.2 },
      { label: 'Capsules', amount: 2.5 },
    ])
  })
})

describe('costSummary', () => {
  const lines = [{ label: 'Pale', amount: 4 }, { label: 'Citra', amount: 6 }]

  it('total, coût au litre et à la bouteille de 33 cl', () => {
    expect(costSummary(lines, 10)).toEqual({ totalEur: 10, perLitreEur: 1, per33clEur: 0.33 })
  })

  it('pas de coût au litre sans volume', () => {
    expect(costSummary(lines, 0)).toEqual({ totalEur: 10, perLitreEur: null, per33clEur: null })
    expect(costSummary(lines, null)).toEqual({ totalEur: 10, perLitreEur: null, per33clEur: null })
  })

  it('total nul sans ligne', () => {
    expect(costSummary([], 10)).toEqual({ totalEur: 0, perLitreEur: 0, per33clEur: 0 })
  })

  it('évite les erreurs d’arrondi des flottants', () => {
    expect(costSummary([{ label: 'a', amount: 0.1 }, { label: 'b', amount: 0.2 }], 1).totalEur).toBe(0.3)
  })
})
