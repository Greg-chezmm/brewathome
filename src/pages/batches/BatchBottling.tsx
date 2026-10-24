import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  bottlingReferenceL,
  compareBottling,
  PACKAGING_FORMATS,
  packagedVolumeL,
  remainingAsContainers,
  type PackagingKey,
} from '@/lib/brew-day/bottling'
import { suggestedConditioningStart } from '@/lib/batches/conditioning'
import { ConditioningCard } from '@/components/batches/ConditioningCard'
import { getBatchWithDetails, updateBatchMeasurements, updateBatchPackaging } from '@/lib/db/queries/batches'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'

const fmtL = (litres: number, digits = 1) =>
  `${litres.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} L`

type Draft = Record<PackagingKey, string>

const toDraft = (counts: Record<PackagingKey, number>): Draft =>
  Object.fromEntries(PACKAGING_FORMATS.map((f) => [f.key, counts[f.key] ? String(counts[f.key]) : ''])) as Draft

const fromDraft = (draft: Draft): Record<PackagingKey, number> =>
  Object.fromEntries(
    PACKAGING_FORMATS.map((f) => {
      const n = Math.round(Number(draft[f.key]))
      return [f.key, Number.isFinite(n) && n > 0 ? n : 0]
    }),
  ) as Record<PackagingKey, number>

/** Embouteillage : contenants remplis (33, 50, 75 cl, fût de 5 L), litres conditionnés comparés à la bière disponible. */
export function BatchBottling() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })
  const equipmentProfileId = batch?.recipeSnapshot.equipmentProfileId
  const { data: equipment } = useQuery({
    queryKey: ['equipment-profile', equipmentProfileId],
    queryFn: () => getEquipmentProfile(equipmentProfileId!),
    enabled: !!equipmentProfileId,
  })

  // Saisie en cours ; tant qu'on n'a rien tapé, les champs reprennent les valeurs enregistrées.
  const [edits, setEdits] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!batch) return <p className="text-slate-500">Chargement…</p>

  const draft = edits ?? toDraft(batch.packaging)

  const counts = fromDraft(draft)
  const packagedL = packagedVolumeL(counts)
  const fermenterL = batch.measurements.fermenterVolumeL
  const referenceL = bottlingReferenceL(fermenterL, batch.recipeSnapshot.targetVolumeL, equipment?.fermenterLossL ?? null)
  const comparison = compareBottling(packagedL, referenceL)
  const remaining = remainingAsContainers(referenceL !== null ? referenceL - packagedL : 0)
  const remainingText = PACKAGING_FORMATS.filter((f) => remaining[f.key]).map(
    (f) => `${remaining[f.key]} × ${f.label.toLowerCase()}`,
  )
  const savedL = batch.measurements.packagingVolumeL

  async function run(action: () => Promise<void>, done: string) {
    setSaving(true)
    setMessage(null)
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      setMessage(done)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Embouteillage</h2>
        <p className="text-sm text-slate-500">
          Comptez les contenants remplis : l'app additionne les litres et les compare à la bière disponible.
        </p>
      </div>

      {referenceL !== null && (
        <p className="text-sm text-slate-700">
          <strong>{fmtL(referenceL)} à conditionner</strong>
          <span className="text-slate-500">
            {' '}
            (
            {fermenterL !== null
              ? `${fmtL(fermenterL)} au fermenteur mesurés`
              : `${fmtL(batch.recipeSnapshot.targetVolumeL)} visés par la recette`}
            {equipment ? `, moins ${fmtL(equipment.fermenterLossL)} de pertes du profil` : ''})
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PACKAGING_FORMATS.map((format) => (
          <label key={format.key} className="block text-sm">
            <span className="text-slate-600">{format.label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              aria-label={format.label}
              value={draft[format.key]}
              onChange={(e) => setEdits({ ...draft, [format.key]: e.target.value })}
              className="field-input mt-1"
            />
            <span className="text-xs text-slate-400">{fmtL(counts[format.key] * format.volumeL, 2)}</span>
          </label>
        ))}
      </div>

      <p className="text-2xl font-bold text-slate-900">{fmtL(packagedL, 2)} conditionnés</p>

      {comparison.verdict !== 'unknown' && (
        <div
          role="status"
          className={`rounded-xl border p-3 text-sm ${
            comparison.verdict === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {comparison.verdict === 'ok' ? (
            <p>Comptage cohérent : écart de {fmtL(Math.abs(comparison.diffL ?? 0))} avec la bière disponible.</p>
          ) : (
            <p>{comparison.advice}</p>
          )}
          {comparison.verdict === 'missing' && remainingText.length > 0 && (
            <p className="mt-1">Pour finir : environ {remainingText.join(' + ')}.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={() => run(() => updateBatchPackaging(batch.id, counts), 'Embouteillage enregistré.')}
        >
          Enregistrer
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={saving || packagedL <= 0}
          onClick={() =>
            run(
              () => updateBatchMeasurements(batch.id, { packagingVolumeL: Math.round(packagedL * 100) / 100 }),
              'Volume conditionné enregistré.',
            )
          }
        >
          Reprendre comme volume conditionné
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>
      {savedL !== null && (
        <p className="text-xs text-slate-500">
          Volume conditionné enregistré : {fmtL(savedL, 2)} (utilisé par le résumé et l'historique).
        </p>
      )}
    </div>
    <ConditioningCard
      key={`${batch.conditioningStart}-${batch.conditioningDays}`}
      batchId={batch.id}
      conditioningStart={batch.conditioningStart}
      conditioningDays={batch.conditioningDays}
      suggestedStart={suggestedConditioningStart(batch.brewDate, batch.recipeSnapshot?.fermentationSteps)}
    />
    </div>
  )
}
