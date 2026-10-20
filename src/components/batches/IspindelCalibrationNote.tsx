import { useState } from 'react'
import type { GravityCalibration } from '@/lib/fermentation/calibration'

const signedPoints = (offset: number) =>
  `${offset >= 0 ? '+' : '−'}${Math.abs(offset * 1000).toFixed(1).replace('.', ',')} pt${Math.abs(offset * 1000) >= 2 ? 's' : ''}`

/** Explique le recalage de l'iSpindel (décalage, pente, manuel) et permet de le régler à la main ou de voir le brut. */
export function IspindelCalibrationNote({
  calibration,
  showRaw,
  onToggleRaw,
  onSaveManualOffset,
}: {
  calibration: GravityCalibration | null
  showRaw: boolean
  onToggleRaw: () => void
  /** Décalage manuel en SG ; `null` revient au recalage automatique. */
  onSaveManualOffset: (offset: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [points, setPoints] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save(offset: number | null) {
    setError(null)
    try {
      await onSaveManualOffset(offset)
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const parsedPoints = Number.parseFloat(points.replace(',', '.'))
  const validPoints = Number.isFinite(parsedPoints) && Math.abs(parsedPoints) <= 50

  let summary = 'Aucun recalage : saisissez la DI au densimètre pour recaler l’iSpindel, ou réglez un décalage à la main.'
  if (showRaw) summary = 'Densités brutes de l’iSpindel.'
  else if (calibration?.manual) summary = `Décalage réglé à la main : ${signedPoints(calibration.offset)}.`
  else if (calibration?.twoPoint)
    summary = `iSpindel recalé sur la DI et la DF au densimètre : ${signedPoints(calibration.offset)} au départ, pente ×${calibration.scale.toFixed(2).replace('.', ',')} (médiane de ${calibration.count} relevés du départ : ${calibration.pivot.toFixed(3)}).`
  else if (calibration)
    summary = `iSpindel recalé sur la DI au densimètre : ${signedPoints(calibration.offset)} (médiane de ${calibration.count} relevés du départ : ${calibration.pivot.toFixed(3)}).`

  return (
    <div className="mt-1 space-y-1 text-xs text-slate-500">
      <p className="flex flex-wrap items-center gap-x-2">
        <span>{summary}</span>
        {calibration && (
          <button type="button" onClick={onToggleRaw} className="font-medium text-indigo-600 hover:underline">
            {showRaw ? 'Appliquer le recalage' : 'Voir les valeurs brutes'}
          </button>
        )}
        <button type="button" onClick={() => setEditing(!editing)} className="font-medium text-indigo-600 hover:underline">
          {editing ? 'Annuler' : 'Régler à la main'}
        </button>
        {calibration?.manual && (
          <button type="button" onClick={() => save(null)} className="font-medium text-indigo-600 hover:underline">
            Revenir au recalage automatique
          </button>
        )}
      </p>
      {editing && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (validPoints) void save(Math.round(parsedPoints) / 1000)
          }}
        >
          <label className="flex items-center gap-1.5">
            Décalage à ajouter (points)
            <input
              type="number"
              step="1"
              inputMode="decimal"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="ex. -3"
              aria-label="Décalage manuel en points"
              className="field-input w-20 py-1"
            />
          </label>
          <button type="submit" disabled={!validPoints} className="btn-primary btn-sm">
            Enregistrer
          </button>
          {error && <span className="text-red-600">{error}</span>}
        </form>
      )}
    </div>
  )
}
