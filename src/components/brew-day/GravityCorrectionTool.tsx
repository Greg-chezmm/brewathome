import { useState } from 'react'
import {
  FERMENTABLE_ADDITION_LABELS,
  calculateDilutionWater,
  calculateFermentableAddition,
  type FermentableAdditionType,
} from '@/lib/brew-calc/gravity-correction'
import { FieldLabel } from '@/components/InfoTooltip'

export function GravityCorrectionTool({ targetGravity }: { targetGravity?: number }) {
  const [currentVolume, setCurrentVolume] = useState('20')
  const [currentGravity, setCurrentGravity] = useState('')
  const [goalGravity, setGoalGravity] = useState(targetGravity ? String(targetGravity) : '')
  const [additionType, setAdditionType] = useState<FermentableAdditionType>('dme')

  const volume = Number.parseFloat(currentVolume)
  const current = Number.parseFloat(currentGravity)
  const target = Number.parseFloat(goalGravity)
  const valid = Number.isFinite(volume) && Number.isFinite(current) && Number.isFinite(target) && current !== target

  let result: React.ReactNode = null
  if (valid) {
    try {
      if (current > target) {
        const { waterToAddL, newVolumeL } = calculateDilutionWater(volume, current, target)
        result = (
          <p className="text-sm font-medium text-indigo-600">
            Densité trop élevée : ajoutez environ <strong>{waterToAddL.toFixed(2)} L d'eau</strong> (nouveau volume ≈{' '}
            {newVolumeL.toFixed(1)} L) pour atteindre {target.toFixed(3)}.
          </p>
        )
      } else {
        const { gramsToAdd } = calculateFermentableAddition(volume, current, target, additionType)
        result = (
          <p className="text-sm font-medium text-indigo-600">
            Densité trop basse : ajoutez environ <strong>{gramsToAdd.toFixed(0)} g</strong> de{' '}
            {FERMENTABLE_ADDITION_LABELS[additionType]} pour atteindre {target.toFixed(3)}.
          </p>
        )
      }
    } catch {
      result = null
    }
  }

  return (
    <div className="card">
      <div className="mb-1 flex items-center gap-1.5">
        <h2 className="section-title">Correction de densité</h2>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Si la densité mesurée s'écarte de la cible, calculez la dilution ou l'ajout de matière nécessaire.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <FieldLabel hint="Le volume de moût que vous avez actuellement (dans la cuve ou le fermenteur) au moment de la mesure.">
            Volume actuel (L)
          </FieldLabel>
          <input
            type="number"
            step="0.1"
            value={currentVolume}
            onChange={(e) => setCurrentVolume(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <FieldLabel hint="La densité que vous venez de mesurer au densimètre ou au réfractomètre.">
            Densité mesurée
          </FieldLabel>
          <input
            type="number"
            step="0.001"
            placeholder="1.050"
            value={currentGravity}
            onChange={(e) => setCurrentGravity(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <FieldLabel hint="La densité visée par la recette à ce stade (généralement l'OG estimée).">
            Densité cible
          </FieldLabel>
          <input
            type="number"
            step="0.001"
            placeholder="1.050"
            value={goalGravity}
            onChange={(e) => setGoalGravity(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <FieldLabel hint="Si la densité est trop basse, choisissez la matière fermentescible que vous comptez ajouter pour la corriger (sucre, extrait sec ou liquide).">
            Matière d'ajout
          </FieldLabel>
          <select
            value={additionType}
            onChange={(e) => setAdditionType(e.target.value as FermentableAdditionType)}
            className="field-input"
          >
            {Object.entries(FERMENTABLE_ADDITION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {result && <div className="mt-3">{result}</div>}
    </div>
  )
}
