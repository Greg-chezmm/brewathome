import { describe, expect, it } from 'vitest'
import { batchTitle } from '@/lib/batches/title'

describe('batchTitle', () => {
  it('préfixe le nom du numéro du brassin', () => {
    expect(batchTitle({ name: 'Barley wine', batchNumber: 12 })).toBe('#12 · Barley wine')
  })

  it('garde le nom seul sans numéro', () => {
    expect(batchTitle({ name: 'Barley wine', batchNumber: null })).toBe('Barley wine')
  })
})
