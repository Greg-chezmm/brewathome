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
  /**
   * Volume en fin d'ébullition ramené à froid (fermenteur + pertes trub/cuve).
   * C'est la base de calcul de la DI, de la couleur et de l'IBU.
   */
  endOfBoilColdVolumeL: number
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

/** Pertes entre la fin d'ébullition et le fermenteur (houblon/trub + volume mort cuve/refroidisseur). */
export function postBoilLossesL(profile: EquipmentProfile): number {
  return profile.hopAbsorptionL + profile.deadspaceL
}

/**
 * Calcule les volumes à rebours depuis le volume visé en fermenteur (specs §1) :
 * fin d'ébullition à froid = fermenteur + pertes ; à chaud = ÷ (1 − contraction) ;
 * pré-ébullition = + évaporation (L/h × durée) ; eau totale = + absorption grain
 * + volume mort de la cuve d'empâtage. Eau d'empâtage = ratio × grain (plafonnée),
 * le reste part au rinçage.
 */
export function calculateVolumes(
  fermenterVolumeL: number,
  grainWeightKg: number,
  boilTimeMin: number,
  profile: EquipmentProfile,
): VolumeBreakdown {
  const endOfBoilColdVolumeL = fermenterVolumeL + postBoilLossesL(profile)
  const postBoilVolumeL = endOfBoilColdVolumeL / (1 - profile.thermalShrinkagePercent / 100)
  const preBoilVolumeL = postBoilVolumeL + profile.evaporationRateLPerHour * (boilTimeMin / 60)
  const totalWaterNeededL =
    preBoilVolumeL + grainWeightKg * profile.grainAbsorptionLPerKg + profile.mashTunDeadspaceL

  const mashWaterL = Math.min(grainWeightKg * profile.waterToGrainRatioLPerKg, totalWaterNeededL)
  const spargeWaterL = totalWaterNeededL - mashWaterL

  return {
    totalWaterNeededL,
    mashWaterL,
    spargeWaterL,
    preBoilVolumeL,
    postBoilVolumeL,
    endOfBoilColdVolumeL,
    volumeIntoFermenterL: fermenterVolumeL,
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
  boilTimeMin: number,
  profile: EquipmentProfile,
): number {
  const postBoilVolumeL = preBoilVolumeL - profile.evaporationRateLPerHour * (boilTimeMin / 60)
  const endOfBoilColdVolumeL = postBoilVolumeL * (1 - profile.thermalShrinkagePercent / 100)
  return endOfBoilColdVolumeL - postBoilLossesL(profile)
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
