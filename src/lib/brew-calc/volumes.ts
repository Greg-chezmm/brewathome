import type { EquipmentProfile } from './types'

/**
 * Volume physique occupé par le grain gorgé d'eau, par kg, en plus de l'eau
 * elle-même (le grain "pousse" le niveau du liquide). Valeur type reprise par
 * Brewfather/BeerSmith : ~0,67 L/kg.
 */
const GRAIN_DISPLACEMENT_L_PER_KG = 0.67

/**
 * Température classique de l'eau de rinçage (sparge), en °C. Assez chaude
 * pour garder le lit de grain fluide et stopper l'activité enzymatique, mais
 * sous 80°C pour éviter l'extraction de tanins depuis les enveloppes de
 * grain. Valeur standard reprise par Brewfather/BeerSmith/Bru'n Water.
 */
export const SPARGE_WATER_TEMP_C = 76

export interface VolumeBreakdown {
  /** Eau totale (empâtage + rinçage) à prévoir. */
  totalWaterNeededL: number
  /** Part de l'eau totale versée directement sur le grain à l'empâtage. */
  mashWaterL: number
  /** Eau de rinçage (le reste de l'eau totale, après l'empâtage). */
  spargeWaterL: number
  /** Volume collecté avant ébullition. */
  preBoilVolumeL: number
  /** Volume en fin d'ébullition, moût encore chaud. */
  postBoilVolumeL: number
  /** Volume final transféré dans le fermenteur, moût refroidi. */
  volumeIntoFermenterL: number
  /**
   * Volume physiquement occupé dans la cuve d'empâtage au moment de
   * l'empâtage : eau d'empâtage + volume déplacé par le grain. Pertinent
   * surtout en BIAB, où c'est la même cuve que l'ébullition — c'est souvent
   * le point le plus contraignant, avant même d'avoir ajouté l'eau de
   * rinçage.
   */
  mashTunFillVolumeL: number
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

  // Répartition empâtage / rinçage : l'eau d'empâtage vise le ratio eau/grain
  // configuré, le reste de l'eau totale part au rinçage. Si le ratio visé
  // dépasse l'eau totale disponible (grain très faible ou ratio très élevé),
  // on plafonne l'empâtage à l'eau totale et le rinçage tombe à 0.
  // Source : AlchemyOverlord / Brewfather — eau d'empâtage = kg × ratio,
  // plafonnée ; le reste = eau de rinçage.
  const mashWaterL = Math.min(grainWeightKg * profile.waterToGrainRatioLPerKg, totalWaterNeededL)
  const spargeWaterL = totalWaterNeededL - mashWaterL

  return {
    totalWaterNeededL,
    mashWaterL,
    spargeWaterL,
    preBoilVolumeL,
    postBoilVolumeL,
    volumeIntoFermenterL: targetFinalVolumeL,
    mashTunFillVolumeL: mashWaterL + grainWeightKg * GRAIN_DISPLACEMENT_L_PER_KG,
  }
}

/**
 * Calcule le volume final attendu en fermenteur à partir d'un volume
 * pré-ébullition réellement mesuré (utile en plein brew day pour vérifier si
 * le volume collecté est cohérent avec la recette, ou pour dimensionner une
 * recette à partir d'une limite de cuve d'ébullition). Fonction inverse de
 * `calculateVolumes`.
 */
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
