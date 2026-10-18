import { describe, expect, it, vi } from 'vitest'
import type { EquipmentProfile } from '@/lib/brew-calc/types'

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))

const { sameEquipmentSettings, uniqueProfileName } = await import('@/lib/db/queries/equipmentProfiles')

/** Équipement « Imported » du Barley wine (brassin Brewfather #31). */
const barleyWine: EquipmentProfile = {
  name: 'Imported',
  boilKettleVolumeL: 24,
  mashTunVolumeL: null,
  targetBatchVolumeL: 12,
  boilTimeMin: 120,
  evaporationRateLPerHour: 3.14,
  grainAbsorptionLPerKg: 1,
  waterToGrainRatioLPerKg: 3,
  mashTunDeadspaceL: 0,
  hopAbsorptionL: 0.5,
  deadspaceL: 0,
  fermenterLossL: 0,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 75,
  hopUtilizationPercent: 100,
  method: 'all-grain',
}

describe('profils d’équipement importés', () => {
  it('ne confond pas deux équipements homonymes aux réglages différents', () => {
    // Brune forte : aussi « Imported » dans Brewfather, mais 60 min et 2,879 L/h.
    const bruneForte = { ...barleyWine, boilTimeMin: 60, evaporationRateLPerHour: 2.879, boilKettleVolumeL: 20 }
    expect(sameEquipmentSettings(barleyWine, bruneForte)).toBe(false)
  })

  it('réutilise un profil identique, même si sa capacité de cuve a été corrigée à la main', () => {
    expect(sameEquipmentSettings({ ...barleyWine, boilKettleVolumeL: 20 }, barleyWine)).toBe(true)
  })

  it('réutilise un profil dont l’efficacité d’empâtage a été recalée sur les brassins mesurés', () => {
    expect(sameEquipmentSettings({ ...barleyWine, mashEfficiencyPercent: 72 }, barleyWine)).toBe(true)
  })

  it('numérote les noms déjà pris', () => {
    expect(uniqueProfileName('Imported', [])).toBe('Imported')
    expect(uniqueProfileName('Imported', ['Imported', 'Imported (2)'])).toBe('Imported (3)')
  })
})
