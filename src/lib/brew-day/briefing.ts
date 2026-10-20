import type { BatchStep, BatchStepType } from '@/lib/db/queries/batches'

export interface Briefing {
  /** Durée cumulée des étapes (minutées, ou estimées pour les autres), hors ajouts calés sur l'ébullition. Les sessions s'additionnent. */
  totalMinutes: number
  equipment: string[]
  safety: string[]
}

const BASE_EQUIPMENT = [
  'Cuve de brassage et cuillère ou pelle en inox',
  'Thermomètre',
  'Densimètre et éprouvette',
  'Fermenteur désinfecté avec son bouchon et son barboteur',
  'Désinfectant sans rinçage (type Star San) et pulvérisateur',
  'Chronomètre ou téléphone (alertes activées)',
]

const SAFETY = [
  "Brûlures : l'eau d'empâtage et de rinçage est à 75-78 °C, le moût bout à 100 °C. Chaussures fermées, gants ou maniques, pas d'enfant ni d'animal dans la cuisine.",
  "Débordement (boil-over) : au premier bouillon la mousse monte d'un coup. Rester devant la cuve, baisser le feu dès les premières bulles.",
  "Cuve de 20 L pleine : plus de 20 kg une fois remplie. La poser avant de la vider, ne pas la porter seul ni sur plusieurs marches, utiliser un robinet ou un tuyau.",
]

/**
 * Durée estimée des étapes sans minuteur (chauffe, rinçage, refroidissement…), en minutes. L'eau de rinçage
 * chauffe pendant l'empâtage, le nettoyage est exclu : ni l'un ni l'autre n'allonge la journée.
 */
const ESTIMATED_DURATION_MIN: Partial<Record<BatchStepType, number>> = {
  'strike-water': 25,
  sparge: 25,
  'heat-to-boil': 25,
  cooling: 30,
  pitch: 10,
}

const has = (steps: BatchStep[], ...types: BatchStepType[]) => steps.some((s) => types.includes(s.stepType))

/** Ce qu'il faut savoir avant d'allumer le feu : durée totale, matériel à préparer, sécurité. */
export function buildBriefing(steps: BatchStep[]): Briefing {
  const totalMinutes = steps
    .filter((s) => s.status !== 'skipped' && s.triggerTimeMin == null)
    .reduce((sum, s) => sum + (s.plannedDurationMin ?? ESTIMATED_DURATION_MIN[s.stepType] ?? 0), 0)

  const equipment = [...BASE_EQUIPMENT]
  if (has(steps, 'mash', 'mash-step')) equipment.push("Sac de brassage (BIAB) ou cuve de filtration pour les grains")
  if (has(steps, 'sparge', 'sparge-water')) equipment.push("Seconde cuve ou arrosoir pour l'eau de rinçage")
  if (has(steps, 'cooling', 'chiller-sanitize')) equipment.push('Refroidisseur à serpentin, ou bac de glace')
  if (has(steps, 'dry-hop-addition')) equipment.push('Sachet ou filtre pour le houblon de la fermentation (dry hop)')

  return { totalMinutes, equipment, safety: [...SAFETY] }
}

/** « 4 h 30 » ou « 45 min ». */
export function formatBriefingDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}
