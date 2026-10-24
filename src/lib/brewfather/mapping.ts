import type {
  BrewMethod,
  EquipmentProfile,
  Fermentable,
  FermentableUse,
  Hop,
  HopUse,
  OtherIngredient,
  Yeast,
} from '@/lib/brew-calc/types'
import type { FermentationStep, FermentationStepType } from '@/lib/brew-calc/fermentation-profile'
import { DEFAULT_WHIRLPOOL_TEMP_C } from '@/lib/brew-calc/ibu'
import { mainMashTempC, type MashStep } from '@/lib/brew-calc/mash'
import type { ParsedRecipeDraft } from '@/lib/beerxml/types'
import type {
  BrewfatherEquipment,
  BrewfatherFermentable,
  BrewfatherHop,
  BrewfatherMisc,
  BrewfatherRecipe,
  BrewfatherYeast,
} from './types'

/** Potentiel du saccharose pur (PPG), référence du rendement en %. */
const SUCROSE_PPG = 46
/**
 * Rendement appliqué par Brewfather à un ingrédient créé sans potentiel (≈ 1.036) :
 * déduit des DI qu'il annonce pour des recettes contenant de tels malts.
 */
export const BREWFATHER_DEFAULT_YIELD_PERCENT = 78

function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value as number)
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

function lower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function mapMethod(type: unknown): BrewMethod {
  const t = lower(type)
  if (t === 'biab') return 'biab'
  if (t.includes('extract') || t.includes('partial')) return 'extract'
  return 'all-grain'
}

function mapFermentableUse(use: unknown): FermentableUse | undefined {
  const u = lower(use)
  if (u === 'mash') return 'mash'
  if (u.includes('boil')) return 'boil'
  if (u.includes('ferment') || u.includes('primary') || u.includes('secondary')) return 'fermentation'
  return undefined
}

function mapFermentable(f: BrewfatherFermentable): Fermentable {
  const type = lower(f.type)
  // Le rendement en % est donné directement ; à défaut, on le déduit de la densité potentielle (1.037 → 37 PPG).
  const yieldPercent =
    f.potentialPercentage
      ? num(f.potentialPercentage)
      : f.potential
        ? ((num(f.potential) - 1) * 1000 / SUCROSE_PPG) * 100
        : BREWFATHER_DEFAULT_YIELD_PERCENT
  return {
    name: f.name?.trim() || 'Fermentescible',
    type: type.includes('extract') ? 'extract' : type === 'sugar' ? 'sugar' : 'grain',
    amountKg: num(f.amount),
    colorLovibond: num(f.color),
    yieldPercent,
    use: mapFermentableUse(f.use),
  }
}

function mapHopUse(use: unknown): HopUse {
  const u = lower(use)
  if (u === 'dry hop') return 'dry-hop'
  if (u === 'first wort') return 'first-wort'
  if (u === 'mash') return 'mash'
  // Brewfather range le hopstand / whirlpool sous « Aroma ».
  if (u === 'aroma' || u === 'whirlpool' || u === 'hopstand') return 'whirlpool'
  return 'boil'
}

function mapHop(h: BrewfatherHop, hopstandTempC: number): Hop {
  const use = mapHopUse(h.use)
  const form = lower(h.type)
  const hop: Hop = {
    name: h.name?.trim() || 'Houblon',
    amountG: num(h.amount),
    alphaAcidPercent: num(h.alpha),
    timeMin: use === 'dry-hop' ? 0 : num(h.time),
    use,
    form: form === 'leaf' ? 'leaf' : form === 'plug' ? 'plug' : 'pellet',
  }
  if (use === 'whirlpool') hop.temperatureC = h.temp ? num(h.temp) : hopstandTempC
  // En dry hop, Brewfather exprime la durée de contact en jours dans « time ».
  if (use === 'dry-hop' && h.time) hop.dryHopDays = num(h.time)
  // « day » : jour d'ajout depuis le début de la fermentation.
  if (use === 'dry-hop' && h.day !== undefined && h.day !== null) hop.dryHopDay = num(h.day)
  return hop
}

function mapYeast(y: BrewfatherYeast): Yeast {
  return {
    name: y.name?.trim() || 'Levure',
    type: lower(y.form) === 'dry' ? 'dry' : 'liquid',
    style: lower(y.type) === 'lager' ? 'lager' : 'ale',
    attenuationPercent: num(y.attenuation, 75),
    ...mapYeastAmount(y),
  }
}

/** Quantité de levure : sachets, grammes ou millilitres (les litres sont convertis). */
function mapYeastAmount(y: BrewfatherYeast): Pick<Yeast, 'amount' | 'amountUnit'> {
  if (y.amount === undefined || y.amount === null || !Number.isFinite(y.amount)) return {}
  const unit = lower(y.unit)
  if (unit === 'g') return { amount: y.amount, amountUnit: 'g' }
  if (unit === 'ml') return { amount: y.amount, amountUnit: 'ml' }
  if (unit === 'l') return { amount: y.amount * 1000, amountUnit: 'ml' }
  if (unit === 'kg') return { amount: y.amount * 1000, amountUnit: 'g' }
  return { amount: y.amount, amountUnit: 'pkg' }
}

function mapFermentationStepType(type: unknown): FermentationStepType {
  const t = lower(type)
  if (t.includes('cold') || t.includes('crash')) return 'cold-crash'
  if (t.includes('second') || t.includes('tert')) return 'secondary'
  if (t.includes('condition') || t.includes('aging') || t.includes('garde') || t.includes('lager')) return 'conditioning'
  return 'primary'
}

/** Profil de fermentation de la recette, dans l'ordre (étapes sans température ignorées). */
function mapFermentationSteps(recipe: BrewfatherRecipe): FermentationStep[] {
  return (recipe.fermentation?.steps ?? [])
    .filter((s) => s.stepTemp !== undefined && s.stepTemp !== null)
    .map((s) => {
      const tempC = num(s.stepTemp)
      // Le type est parfois générique : le nom (« Cold crash », « Garde ») précise l'étape.
      const fromName = mapFermentationStepType(s.name)
      const type = s.name && fromName !== 'primary' ? fromName : mapFermentationStepType(s.type)
      return { type, tempC, days: num(s.stepTime) }
    })
}

function miscAmount(m: BrewfatherMisc): string {
  return [m.amount, m.unit].filter((part) => part !== undefined && part !== '').join(' ')
}

function mapBoilMisc(m: BrewfatherMisc): OtherIngredient {
  return { name: m.name?.trim() || 'Ajout', amount: miscAmount(m), timeMin: num(m.time) }
}

/** Usages Brewfather d'un ajout fait dans le fermenteur. */
const FERMENTATION_MISC_USES = ['primary', 'secondary']

/** Ajout en fermentation (copeaux de chêne…) : `time` y est une durée de contact, en jours sauf `timeIsDays: false`. */
function mapFermentationMisc(m: BrewfatherMisc): OtherIngredient {
  const time = num(m.time)
  const contactDays = m.timeIsDays === false ? Math.round(time / 1440) : time
  return {
    name: m.name?.trim() || 'Ajout',
    amount: miscAmount(m),
    timeMin: 0,
    use: 'fermentation',
    ...(contactDays > 0 && { contactDays }),
  }
}

/** Paliers d'empâtage de la recette, dans l'ordre (ceux sans température sont ignorés). */
function mapMashSteps(recipe: BrewfatherRecipe): MashStep[] {
  return (recipe.mash?.steps ?? [])
    .filter((s) => s.stepTemp !== undefined && s.stepTemp !== null)
    .map((s, i) => ({ name: s.name?.trim() || `Palier ${i + 1}`, tempC: num(s.stepTemp), timeMin: num(s.stepTime) }))
}

/** Pourcentage que Brewfather peut stocker en fraction (contraction 0,04 ; utilisation houblon 1 = 100 %). */
function percent(value: unknown, fallback: number, fractionBelow = 1): number {
  const v = num(value, fallback)
  return v > 0 && v <= fractionBelow ? v * 100 : v
}

/** Noms que Brewfather donne à tout équipement importé (BeerXML, autre logiciel) : ils ne le distinguent pas. */
const GENERIC_EQUIPMENT_NAME = /^\s*(imported|import|default)\s*$/i

/** Capacité écrite dans le nom (« Marmite 20L » → 20) : Brewfather ne stocke pas la taille de la cuve. */
export function kettleVolumeFromName(name: string | undefined): number | undefined {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:l|litres?)\b/i.exec(name ?? '')
  const volume = match ? Number.parseFloat(match[1].replace(',', '.')) : Number.NaN
  return volume > 0 ? volume : undefined
}

/**
 * Profil d'équipement Brewfather → notre profil. Null si la recette n'en a pas.
 * Brewfather ne connaît que le volume pré-ébullition, pas la capacité de la cuve : à défaut de la lire
 * dans le nom, on l'estime à 1,2 × pré-ébullition (à corriger dans le profil).
 */
export function brewfatherEquipmentToProfile(recipe: BrewfatherRecipe): EquipmentProfile | null {
  const e: BrewfatherEquipment | null | undefined = recipe.equipment
  if (!e) return null
  const batchSize = num(e.batchSize ?? recipe.batchSize, 20)
  const boilSize = num(e.boilSize ?? recipe.boilSize, batchSize * 1.3)
  const name = e.name?.trim()
  return {
    name: name && !GENERIC_EQUIPMENT_NAME.test(name) ? name : `Équipement de « ${recipe.name?.trim() || 'recette Brewfather'} »`,
    boilKettleVolumeL: num(e.boilKettleVolume ?? e.kettleSize ?? kettleVolumeFromName(name), Math.ceil(boilSize * 1.2)),
    mashTunVolumeL: e.mashTunVolume ? num(e.mashTunVolume) : null,
    targetBatchVolumeL: batchSize,
    boilTimeMin: num(e.boilTime ?? recipe.boilTime, 60),
    evaporationRateLPerHour: num(e.boilOffPerHr, 3),
    grainAbsorptionLPerKg: num(e.grainAbsorptionRate, 1),
    waterToGrainRatioLPerKg: num(e.waterGrainRatio, 3),
    mashTunDeadspaceL: num(e.mashTunDeadSpace),
    // Brewfather réunit houblon/trub et volume mort de la cuve/refroidisseur.
    hopAbsorptionL: num(e.trubChillerLoss),
    deadspaceL: 0,
    fermenterLossL: num(e.fermenterLoss),
    thermalShrinkagePercent: percent(e.coolingShrinkage, 4, 0.5),
    mashEfficiencyPercent: num(e.mashEfficiency ?? recipe.mashEfficiency ?? e.efficiency ?? recipe.efficiency, 72),
    hopUtilizationPercent: percent(e.hopUtilization, 100, 2),
    method: mapMethod(recipe.type),
  }
}

/**
 * Recette Brewfather → brouillon de recette (même format que l'import BeerXML).
 * L'efficacité retenue est celle d'empâtage : comme dans nos calculs, elle mesure le
 * sucre qui arrive dans la cuve d'ébullition (les pertes sont comptées dans les volumes).
 */
export function brewfatherRecipeToDraft(recipe: BrewfatherRecipe): ParsedRecipeDraft {
  const hopstandTempC = num(recipe.equipment?.hopstandTemperature, DEFAULT_WHIRLPOOL_TEMP_C)
  const categoryNumber = recipe.style?.categoryNumber
  const mashSteps = mapMashSteps(recipe)
  const fermentationSteps = mapFermentationSteps(recipe)
  return {
    name: recipe.name?.trim() || 'Recette Brewfather',
    type: mapMethod(recipe.type),
    targetVolumeL: num(recipe.batchSize, 20),
    boilVolumeL: recipe.boilSize !== undefined ? num(recipe.boilSize) : undefined,
    boilTimeMin: num(recipe.boilTime, 60),
    mashEfficiencyPercent: num(recipe.mashEfficiency ?? recipe.efficiency, 72),
    mashSteps: mashSteps.length > 0 ? mashSteps : undefined,
    mashTempC: mashSteps.length > 0 ? mainMashTempC(mashSteps) : undefined,
    fermentationSteps: fermentationSteps.length > 0 ? fermentationSteps : undefined,
    carbonationVols: recipe.carbonation ? num(recipe.carbonation) : undefined,
    notes: recipe.notes?.trim() || undefined,
    style: recipe.style?.name
      ? {
          name: recipe.style.name,
          category: recipe.style.category,
          categoryNumber: categoryNumber !== undefined ? String(categoryNumber) : undefined,
          styleLetter: recipe.style.styleLetter,
          styleGuide: recipe.style.styleGuide,
        }
      : null,
    fermentables: (recipe.fermentables ?? []).map(mapFermentable),
    hops: (recipe.hops ?? []).map((h) => mapHop(h, hopstandTempC)),
    yeasts: (recipe.yeasts ?? []).map(mapYeast),
    otherIngredients: (recipe.miscs ?? []).flatMap((m) =>
      lower(m.use) === 'boil'
        ? [mapBoilMisc(m)]
        : FERMENTATION_MISC_USES.includes(lower(m.use))
          ? [mapFermentationMisc(m)]
          : [],
    ),
    sourceEstimates: {
      og: recipe.og,
      fg: recipe.fg,
      ibu: recipe.ibu,
      color: recipe.color,
      abv: recipe.abv,
    },
  }
}
