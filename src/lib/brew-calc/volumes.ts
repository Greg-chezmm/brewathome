import type { EquipmentProfile } from './types'

export interface VolumeBreakdown {
  /** Eau totale (empâtage + rinçage) à prévoir. */
  totalWaterNeededL: number
  /** Volume collecté avant ébullition. */
  preBoilVolumeL: number
  /** Volume en fin d'ébullition, moût encore chaud. */
  postBoilVolumeL: number
  /** Volume final transféré dans le fermenteur, moût refroidi. */
  volumeIntoFermenterL: number
}

/**
 * Calcule, en partant du volume final visé en fermenteur, les volumes
 * intermédiaires nécessaires à chaque étape (eau totale, pré-ébullition,
 * post-ébullition), en intégrant les pertes du profil d'équipement :
 * absorption du grain, évaporation, absorption houblon/trub, deadspace de
 * cuve et contraction thermique au refroidissement.
 */
export function calculateVolumes(
  targetFinalVolumeL: number,
  grainWeightKg: number,
  profile: EquipmentProfile,
): VolumeBreakdown {
  const boilTimeHours = profile.boilTimeMin / 60

  // Volume chaud à soutirer de la cuve d'ébullition pour, une fois les pertes
  // houblon/trub et deadspace retirées puis la contraction thermique
  // appliquée, obtenir le volume final visé.
  const postBoilVolumeL =
    targetFinalVolumeL / (1 - profile.thermalShrinkagePercent / 100) +
    profile.hopAbsorptionL +
    profile.deadspaceL

  const evaporationLossFraction = (profile.evaporationRatePercentPerHour / 100) * boilTimeHours
  const preBoilVolumeL = postBoilVolumeL / (1 - evaporationLossFraction)

  const totalWaterNeededL = preBoilVolumeL + grainWeightKg * profile.grainAbsorptionLPerKg

  return {
    totalWaterNeededL,
    preBoilVolumeL,
    postBoilVolumeL,
    volumeIntoFermenterL: targetFinalVolumeL,
  }
}

/**
 * Calcule le volume final attendu en fermenteur à partir d'un volume
 * pré-ébullition réellement mesuré (utile en plein brew day pour vérifier si
 * le volume collecté est cohérent avec la recette). Fonction inverse de
 * `calculateVolumes`.
 */
/**
 * Température de l'eau d'empâtage à viser pour atteindre une température de
 * palier donnée, compte tenu de l'inertie thermique du grain (qui est plus
 * froid que l'eau et absorbe de la chaleur au contact).
 * Source : formule de bilan thermique standard du brassage amateur (reprise
 * par Brewfather et la plupart des calculateurs type BeerSmith/Bru'n Water).
 */
export function calculateStrikeWaterTempC(
  targetMashTempC: number,
  grainTempC: number,
  waterToGrainRatioLPerKg: number,
): number {
  return targetMashTempC + (0.4 * (targetMashTempC - grainTempC)) / waterToGrainRatioLPerKg
}

export function estimateFinalVolumeFromPreBoil(
  preBoilVolumeL: number,
  profile: EquipmentProfile,
): number {
  const boilTimeHours = profile.boilTimeMin / 60
  const evaporationLossFraction = (profile.evaporationRatePercentPerHour / 100) * boilTimeHours
  const postBoilVolumeL = preBoilVolumeL * (1 - evaporationLossFraction)
  const hotTransferVolumeL = postBoilVolumeL - profile.hopAbsorptionL - profile.deadspaceL
  return hotTransferVolumeL * (1 - profile.thermalShrinkagePercent / 100)
}
