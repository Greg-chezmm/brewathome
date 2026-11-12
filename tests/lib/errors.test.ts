import { describe, expect, it } from 'vitest'
import { errorMessage } from '@/lib/errors'

describe('errorMessage : message lisible d’une erreur inconnue', () => {
  it('reprend le message d’une Error', () => {
    expect(errorMessage(new Error('réseau coupé'))).toBe('réseau coupé')
  })

  it('reprend le message d’une erreur Supabase (objet { message } qui n’est pas une Error)', () => {
    expect(errorMessage({ message: 'permission denied for table batches', code: '42501' })).toBe(
      'permission denied for table batches',
    )
  })

  it('reprend une chaîne levée telle quelle', () => {
    expect(errorMessage('délai dépassé')).toBe('délai dépassé')
  })

  it('donne un message par défaut quand rien n’est exploitable', () => {
    expect(errorMessage(undefined)).toBe('Une erreur est survenue. Réessayez.')
    expect(errorMessage(new Error(''))).toBe('Une erreur est survenue. Réessayez.')
    expect(errorMessage({ message: 42 })).toBe('Une erreur est survenue. Réessayez.')
  })
})
