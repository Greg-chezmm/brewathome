import { defaultMashSteps } from '@/lib/brew-calc/mash'
import type { RecipeInput } from '@/lib/db/queries/recipes'

/**
 * Recette offerte à la création d'un compte : une American Pale Ale classique de 20 L,
 * dans toutes les plages du style BJCP, pour découvrir l'app sur un exemple complet
 * (empâtage, houblons d'amertume, whirlpool, dry hop, clarifiant).
 */
export const STARTER_RECIPE: RecipeInput = {
  name: 'Ma première Pale Ale',
  styleId: '18b-american-pale-ale',
  type: 'all-grain',
  targetVolumeL: 20,
  boilTimeMin: 60,
  mashEfficiencyPercent: 72,
  mashTempC: 67,
  mashSteps: defaultMashSteps(67),
  fermentationSteps: [
    { type: 'primary', tempC: 18, days: 12 },
    { type: 'cold-crash', tempC: 2, days: 2 },
  ],
  carbonationVols: 2.4,
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes:
    'Recette d’exemple : une pale ale américaine, maltée juste ce qu’il faut et bien houblonnée (agrumes, fruits tropicaux). ' +
    'Choisissez votre profil d’équipement pour obtenir les volumes d’eau, puis validez-la en brassin pour suivre le Brew Day pas à pas.',
  fermentables: [
    { name: 'Pale Ale', type: 'grain', amountKg: 4.3, colorLovibond: 3, yieldPercent: 80 },
    { name: 'Crystal 40', type: 'grain', amountKg: 0.3, colorLovibond: 40, yieldPercent: 74 },
    { name: 'Carapils', type: 'grain', amountKg: 0.2, colorLovibond: 1.5, yieldPercent: 72 },
  ],
  hops: [
    { name: 'Magnum', amountG: 14, alphaAcidPercent: 13, timeMin: 60, use: 'boil', form: 'pellet' },
    { name: 'Cascade', amountG: 25, alphaAcidPercent: 6.5, timeMin: 10, use: 'boil', form: 'pellet' },
    { name: 'Citra', amountG: 30, alphaAcidPercent: 12.5, timeMin: 20, use: 'whirlpool', form: 'pellet', temperatureC: 80 },
    { name: 'Cascade', amountG: 50, alphaAcidPercent: 6.5, timeMin: 0, use: 'dry-hop', form: 'pellet', dryHopDays: 4, dryHopTempC: 18, dryHopDay: 8 },
  ],
  yeasts: [{ name: 'SafAle US-05', type: 'dry', style: 'ale', attenuationPercent: 78, amount: 1, amountUnit: 'pkg' }],
  otherIngredients: [{ name: 'Whirlfloc', amount: '1 pastille', timeMin: 10 }],
}
