/**
 * Sous-ensemble des objets renvoyés par l'API Brewfather v2 (unités métriques).
 * Tout est optionnel : on ne lit que ce qui sert à l'import et à la comparaison,
 * et l'API peut omettre un champ vide.
 */
export interface BrewfatherCredentials {
  /** Identifiant utilisateur Brewfather (Paramètres → API). */
  userId: string
  apiKey: string
}

export interface BrewfatherFermentable {
  name?: string
  type?: string
  amount?: number
  color?: number
  potential?: number
  potentialPercentage?: number
  use?: string
}

export interface BrewfatherHop {
  name?: string
  amount?: number
  alpha?: number
  time?: number
  use?: string
  type?: string
  temp?: number
  day?: number
}

export interface BrewfatherYeast {
  name?: string
  type?: string
  form?: string
  attenuation?: number
}

export interface BrewfatherMisc {
  name?: string
  amount?: number
  unit?: string
  use?: string
  time?: number
}

export interface BrewfatherMashStep {
  stepTemp?: number
  stepTime?: number
}

export interface BrewfatherEquipment {
  name?: string
  batchSize?: number
  boilSize?: number
  boilTime?: number
  boilOffPerHr?: number
  efficiency?: number
  mashEfficiency?: number
  trubChillerLoss?: number
  fermenterLoss?: number
  mashTunDeadSpace?: number
  grainAbsorptionRate?: number
  waterGrainRatio?: number
  hopUtilization?: number
  coolingShrinkage?: number
  hopstandTemperature?: number
  boilKettleVolume?: number
  kettleSize?: number
  mashTunVolume?: number
}

export interface BrewfatherRecipe {
  _id: string
  name?: string
  type?: string
  author?: string
  batchSize?: number
  boilSize?: number
  boilTime?: number
  efficiency?: number
  mashEfficiency?: number
  og?: number
  fg?: number
  ibu?: number
  color?: number
  abv?: number
  notes?: string
  style?: {
    name?: string
    category?: string
    categoryNumber?: string | number
    styleLetter?: string
    styleGuide?: string
  } | null
  equipment?: BrewfatherEquipment | null
  fermentables?: BrewfatherFermentable[]
  hops?: BrewfatherHop[]
  yeasts?: BrewfatherYeast[]
  miscs?: BrewfatherMisc[]
  mash?: { steps?: BrewfatherMashStep[] } | null
}
