import { useState } from 'react'
import { calculateStrikeWaterTempC } from '@/lib/brew-calc/volumes'
import { FieldLabel } from '@/components/InfoTooltip'

export function StrikeWaterTool({
  defaultTargetTempC = 67,
  defaultGrainWeightKg,
  defaultWaterVolumeL,
  embedded = false,
}: {
  defaultTargetTempC?: number
  defaultGrainWeightKg?: number
  defaultWaterVolumeL?: number
  /** Rendu compact, sans carte englobante ni titre — pour intégration dans l'étape d'empâtage du Brew Day. */
  embedded?: boolean
}) {
  const [targetTemp, setTargetTemp] = useState(String(defaultTargetTempC))
  const [grainTemp, setGrainTemp] = useState('20')
  const [grainWeight, setGrainWeight] = useState(defaultGrainWeightKg ? String(defaultGrainWeightKg) : '')
  const [waterVolume, setWaterVolume] = useState(
    defaultWaterVolumeL
      ? String(defaultWaterVolumeL)
      : defaultGrainWeightKg
        ? String(Math.round(defaultGrainWeightKg * 3 * 10) / 10)
        : '',
  )

  const target = Number.parseFloat(targetTemp)
  const grain = Number.parseFloat(grainTemp)
  const weightKg = Number.parseFloat(grainWeight)
  const volumeL = Number.parseFloat(waterVolume)
  const ratio = weightKg > 0 ? volumeL / weightKg : NaN
  const valid = Number.isFinite(target) && Number.isFinite(grain) && Number.isFinite(ratio) && ratio > 0

  const strikeTemp = valid ? calculateStrikeWaterTempC(target, grain, ratio) : null

  const content = (
    <>
      {!embedded && (
        <>
          <h2 className="section-title mb-1">Température d'eau d'empâtage</h2>
          <p className="mb-3 text-sm text-stone-500">
            Calcule la température à laquelle chauffer l'eau d'empâtage pour atteindre le palier visé, en tenant
            compte de l'inertie thermique du grain (plus froid que l'eau).
          </p>
        </>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <FieldLabel hint="La température de palier d'empâtage visée (ex : 67°C pour un empâtage standard).">
            Palier visé (°C)
          </FieldLabel>
          <input
            type="number"
            step="0.5"
            value={targetTemp}
            onChange={(e) => setTargetTemp(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <FieldLabel hint="Température du grain avant empâtage (température ambiante si stocké à l'intérieur).">
            Temp. du grain (°C)
          </FieldLabel>
          <input
            type="number"
            step="0.5"
            value={grainTemp}
            onChange={(e) => setGrainTemp(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <FieldLabel hint="Poids total du grain à empâter.">Poids de grain (kg)</FieldLabel>
          <input
            type="number"
            step="0.1"
            value={grainWeight}
            onChange={(e) => setGrainWeight(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <FieldLabel hint="Volume d'eau d'empâtage prévu (hors eau de rinçage).">Eau d'empâtage (L)</FieldLabel>
          <input
            type="number"
            step="0.1"
            value={waterVolume}
            onChange={(e) => setWaterVolume(e.target.value)}
            className="field-input"
          />
        </div>
      </div>
      {strikeTemp !== null && (
        <p className="mt-3 text-sm font-medium text-amber-800">
          Chauffez l'eau à <strong>{strikeTemp.toFixed(1)} °C</strong> avant d'y verser le grain
          {Number.isFinite(ratio) && <> (ratio {ratio.toFixed(1)} L/kg)</>}.
        </p>
      )}
    </>
  )

  if (embedded) return content
  return <div className="card">{content}</div>
}
