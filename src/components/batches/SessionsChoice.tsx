import { fermentableUse } from '@/lib/brew-calc/gravity'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { formatWeightKg } from '@/lib/brew-calc/units'
import { MAX_BREW_SESSIONS, sessionRecipe, sessionVolumes } from '@/lib/brew-day/sessions'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const fmtL = (l: number) => `${l.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} L`

/**
 * Brasser la recette en une ou deux sessions le même jour (cuve d'ébullition trop petite) :
 * case à cocher, avec ce que représente une session et l'alerte de débordement de la cuve.
 */
export function SessionsChoice({
  recipe,
  equipment,
  value,
  onChange,
  disabled = false,
}: {
  recipe: RecipeDetails
  equipment: EquipmentProfile | null | undefined
  value: number
  onChange: (sessions: number) => void
  disabled?: boolean
}) {
  const whole = sessionVolumes(recipe, 1, equipment)
  const part = sessionRecipe(recipe, MAX_BREW_SESSIONS)
  const partVolumes = sessionVolumes(recipe, MAX_BREW_SESSIONS, equipment)
  const partGrainKg = part.fermentables
    .filter((f) => f.type === 'grain' && fermentableUse(f) === 'mash')
    .reduce((sum, f) => sum + f.amountKg, 0)
  const kettleL = equipment?.boilKettleVolumeL
  const overflow = (volumeL: number | undefined) => kettleL !== undefined && volumeL !== undefined && volumeL > kettleL + 0.05

  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={value > 1}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? MAX_BREW_SESSIONS : 1)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Brasser en {MAX_BREW_SESSIONS} sessions</span> le même jour, vers un seul fermenteur
        </span>
      </label>
      {overflow(whole?.preBoilVolumeL) && value === 1 && (
        <p className="text-xs text-amber-700">
          La recette demande {fmtL(whole!.preBoilVolumeL)} avant ébullition, plus que votre cuve ({fmtL(kettleL!)}) : brassez-la en{' '}
          {MAX_BREW_SESSIONS} sessions.
        </p>
      )}
      {value > 1 && (
        <p className="text-xs text-slate-500">
          Chaque session : {formatWeightKg(partGrainKg)} de grain
          {partVolumes && `, ${fmtL(partVolumes.preBoilVolumeL)} avant ébullition`}, {fmtL(part.targetVolumeL)} versés au
          fermenteur. Levure, ajouts en fermentation et houblonnage à froid : une seule fois, pour tout le fermenteur.
        </p>
      )}
      {value > 1 && overflow(partVolumes?.preBoilVolumeL) && (
        <p className="text-xs text-amber-700">Même en {MAX_BREW_SESSIONS} sessions, la cuve ({fmtL(kettleL!)}) est trop petite.</p>
      )}
    </div>
  )
}
