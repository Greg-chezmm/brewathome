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
  potential?: number | null
  potentialPercentage?: number | null
  use?: string
}

export interface BrewfatherHop {
  name?: string
  amount?: number
  alpha?: number
  time?: number
  use?: string
  type?: string
  temp?: number | null
  day?: number
  /** IBU de cet ajout calculé par Brewfather. */
  ibu?: number
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
  name?: string | null
  /** Temperature, Infusion, Decoction… */
  type?: string | null
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
  /** DF de la recette : estimation, ou valeur saisie à la main si l'utilisateur l'a remplacée. */
  fg?: number
  /** DF estimée par Brewfather. */
  fgEstimated?: number
  ibu?: number
  color?: number
  abv?: number
  /** Atténuation retenue par Brewfather (fraction, ajustée selon l'empâtage et les fermentescibles). */
  attenuation?: number
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

/** Relevé de fermentation d'un brassin Brewfather (`GET /batches/:id/readings`). */
export interface BrewfatherReading {
  /** Horodatage en millisecondes depuis l'époque Unix. */
  time: number
  /** Densité spécifique (ex. 1.012). */
  sg?: number | null
  /** Température en °C. */
  temp?: number | null
  /** Angle de l'iSpindel. */
  angle?: number | null
  /** Tension de la batterie (V). */
  battery?: number | null
  /** Source : « iSpindel », « manual », « Tilt »… */
  type?: string
  /** Nom de l'appareil. */
  id?: string
  comment?: string | null
}

/** Statuts d'un brassin Brewfather. */
export type BrewfatherBatchStatus = 'Planning' | 'Brewing' | 'Fermenting' | 'Conditioning' | 'Completed' | 'Archived'

/** Brassin Brewfather (`GET /batches?complete=true`) : copie de la recette et mesures du brasseur. */
export interface BrewfatherBatch {
  _id: string
  name?: string
  batchNo?: number
  status?: BrewfatherBatchStatus | string
  /** Date de brassage, en millisecondes depuis l'époque Unix. */
  brewDate?: number
  /** Copie de la recette faite au lancement du brassin (modifiable dans Brewfather). */
  recipe?: BrewfatherRecipe | null
  measuredOg?: number
  measuredFg?: number
  measuredPreBoilGravity?: number
  measuredPostBoilGravity?: number
  /** Volume en cuve en fin d'ébullition (chaud), en litres. */
  measuredKettleSize?: number
  measuredFermenterTopUp?: number
  measuredMashPh?: number
  /** Température retenue pour le resucrage : la plus haute de la fermentation. */
  measuredBottlingTemp?: number
  /** Volume mis en fermenteur, en litres. */
  measuredBatchSize?: number
  /** Volume pré-ébullition (chaud), en litres. */
  measuredBoilSize?: number
  measuredBottlingSize?: number
  /** Rendement global mesuré (jusqu'au fermenteur), en %. */
  measuredEfficiency?: number
  measuredMashEfficiency?: number
  /** Atténuation apparente mesurée, en %. */
  measuredAttenuation?: number
  measuredAbv?: number
  estimatedOg?: number
  estimatedFg?: number
}
