import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DEFAULT_CONDITIONING_DAYS, readyLabel, todayIso } from '@/lib/batches/conditioning'
import { updateBatchConditioning } from '@/lib/db/queries/batches'

/** Durée saisie → jours entiers (1 à 365), null si vide, NaN si invalide. */
function parseDays(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : Number.NaN
}

/**
 * Suivi du conditionnement : début du conditionnement et durée de refermentation (21 jours par défaut),
 * d'où la date « prête à boire » calculée.
 */
export function ConditioningCard({
  batchId,
  conditioningStart,
  conditioningDays,
  today = todayIso(),
  suggestedStart = null,
}: {
  batchId: string
  conditioningStart: string | null
  conditioningDays: number | null
  /** Jour de référence (AAAA-MM-JJ), injectable pour les tests. */
  today?: string
  /** Fin de fermentation prévue : proposée par un bouton, jamais imposée. */
  suggestedStart?: string | null
}) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(conditioningStart ?? '')
  const [daysText, setDaysText] = useState(conditioningDays !== null ? String(conditioningDays) : '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const days = parseDays(daysText)
  const daysValid = days === null || Number.isInteger(days)
  const label = daysValid ? readyLabel(date || null, days ?? DEFAULT_CONDITIONING_DAYS, today) : null

  async function save() {
    if (!daysValid) return
    setSaving(true)
    setMessage(null)
    setFailed(false)
    try {
      await updateBatchConditioning(batchId, { conditioningStart: date || null, conditioningDays: days })
      await queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      setMessage('Conditionnement enregistré.')
    } catch (err) {
      setFailed(true)
      setMessage((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Conditionnement</h2>
        <p className="text-sm text-slate-500">
          Refermentation en bouteille : compte {DEFAULT_CONDITIONING_DAYS} jours par défaut (2 à 3 semaines).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-600">
          Début du conditionnement
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input mt-1" />
        </label>
        <label className="block text-sm text-slate-600">
          Durée de conditionnement (jours)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            step={1}
            placeholder={String(DEFAULT_CONDITIONING_DAYS)}
            value={daysText}
            onChange={(e) => setDaysText(e.target.value)}
            className="field-input mt-1"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestedStart && (
          <button type="button" onClick={() => setDate(suggestedStart)} className="btn-secondary text-sm">
            Fin de fermentation prévue : {suggestedStart.split('-').reverse().join('/')}
          </button>
        )}
        <button type="button" onClick={() => setDate(today)} className="btn-secondary text-sm">
          Aujourd’hui
        </button>
      </div>
      {label ? (
        <p className="text-base font-semibold text-slate-900">{label}</p>
      ) : (
        <p className="text-sm text-slate-600">Renseigne la début du conditionnement pour connaître la date « prête à boire ».</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving || !daysValid} className="btn-primary">
          {saving ? 'Enregistrement…' : 'Enregistrer le conditionnement'}
        </button>
        {message && (
          <p role="status" className={`text-sm ${failed ? 'text-red-600' : 'text-emerald-700'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
