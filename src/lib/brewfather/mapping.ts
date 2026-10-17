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
import { DEFAULT_WHIRLPOOL_TEMP_C } from '@/lib/brew-calc/ibu'
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

function num(value: unknown, fallback = 0): number {
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
    f.potentialPercentage !== undefined
      ? num(f.potentialPercentage)
      : f.potential
        ? ((num(f.potential) - 1) * 1000 / SUCROSE_PPG) * 100
        : 75
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
  return hop
}

function mapYeast(y: BrewfatherYeast): Yeast {
  return {
    name: y.name?.trim() || 'Levure',
    type: lower(y.form) === 'dry' ? 'dry' : 'liquid',
    style: lower(y.type) === 'lager' ? 'lager' : 'ale',
    attenuationPercent: num(y.attenuation, 75),
  }
}

function mapBoilMisc(m: BrewfatherMisc): OtherIngredient {
  return {
    name: m.name?.trim() || 'Ajout',
    amount: [m.amount, m.unit].filter((part) => part !== undefined && part !== '').join(' '),
    timeMin: num(m.time),
  }
}

/** Palier principal = le plus long (la saccharification). */
function mainMashTemp(recipe: BrewfatherRecipe): number | undefined {
  const main = [...(recipe.mash?.steps ?? [])]
    .filter((s) => s.stepTemp !== undefined)
    .sort((a, b) => num(b.stepTime) - num(a.stepTime))[0]
  return main ? num(main.stepTemp) : undefined
}

/** Contraction en % : Brewfather la stocke parfois en fraction (0,04). */
function shrinkagePercent(value: unknown): number {
  const v = num(value, 4)
  return v > 0 && v < 1 ? v * 100 : v
}

/** Profil d'équipement Brewfather → notre profil. Null si la recette n'en a pas. */
export function brewfatherEquipmentToProfile(recipe: BrewfatherRecipe): EquipmentProfile | null {
  const e: BrewfatherEquipment | null | undefined = recipe.equipment
  if (!e) return null
  const batchSize = num(e.batchSize ?? recipe.batchSize, 20)
  const boilSize = num(e.boilSize ?? recipe.boilSize, batchSize * 1.3)
  return {
    name: e.name?.trim() || `Équipement de « ${recipe.name ?? 'recette Brewfather'} »`,
    boilKettleVolumeL: num(e.boilKettleVolume ?? e.kettleSize, Math.ceil(boilSize * 1.2)),
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
    thermalShrinkagePercent: shrinkagePercent(e.coolingShrinkage),
    mashEfficiencyPercent: num(e.mashEfficiency ?? recipe.mashEfficiency ?? e.efficiency ?? recipe.efficiency, 72),
    hopUtilizationPercent: num(e.hopUtilization, 100),
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
  return {
    name: recipe.name?.trim() || 'Recette Brewfather',
    type: mapMethod(recipe.type),
    targetVolumeL: num(recipe.batchSize, 20),
    boilVolumeL: recipe.boilSize !== undefined ? num(recipe.boilSize) : undefined,
    boilTimeMin: num(recipe.boilTime, 60),
    mashEfficiencyPercent: num(recipe.mashEfficiency ?? recipe.efficiency, 72),
    mashTempC: mainMashTemp(recipe),
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
    otherIngredients: (recipe.miscs ?? []).filter((m) => lower(m.use) === 'boil').map(mapBoilMisc),
    sourceEstimates: {
      og: recipe.og,
      fg: recipe.fg,
      ibu: recipe.ibu,
      color: recipe.color,
      abv: recipe.abv,
    },
  }
}
