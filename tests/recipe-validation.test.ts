import { describe, expect, it } from 'vitest'
import { recipeFormErrors } from '@/lib/recipe/validation'

describe('recipeFormErrors', () => {
  it('ne signale rien pour un volume valide', () => {
    expect(recipeFormErrors({ targetVolumeL: 20 })).toEqual([])
  })

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('refuse un volume cible de %s', (targetVolumeL) => {
    const errors = recipeFormErrors({ targetVolumeL })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/volume/i)
  })
})
