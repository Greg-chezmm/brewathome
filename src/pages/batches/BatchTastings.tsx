import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { todayIso } from '@/lib/batches/conditioning'
import { averageRating, newTasting, type Tasting } from '@/lib/batches/tastings'
import { getBatchWithDetails, updateBatchTastings } from '@/lib/db/queries/batches'

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const TEXT_FIELDS: { key: 'appearance' | 'aroma' | 'taste' | 'changeNext'; label: string; placeholder: string }[] = [
  { key: 'appearance', label: 'Aspect', placeholder: 'Couleur, limpidité, mousse…' },
  { key: 'aroma', label: 'Arôme', placeholder: 'Malt, houblon, levure…' },
  { key: 'taste', label: 'Goût', placeholder: 'Amertume, rondeur, finale…' },
  { key: 'changeNext', label: 'À changer la prochaine fois', placeholder: 'Ce que tu ferais autrement' },
]

/** Dégustations du brassin : note sur 5, aspect, arôme, goût et « à changer la prochaine fois », à plusieurs dates. */
export function BatchTastings() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })
  // Liste en cours d'édition ; tant qu'on n'a rien touché, on affiche celle enregistrée.
  const [edits, setEdits] = useState<Tasting[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  if (!batch) return <p className="text-slate-500">Chargement…</p>

  const tastings = edits ?? batch.tastings
  const average = averageRating(tastings)

  const change = (next: Tasting[]) => {
    setEdits(next)
    setMessage(null)
  }
  const patch = (id: string, changes: Partial<Tasting>) => change(tastings.map((t) => (t.id === id ? { ...t, ...changes } : t)))

  async function save() {
    setSaving(true)
    setMessage(null)
    setFailed(false)
    try {
      await updateBatchTastings(batch!.id, tastings)
      await queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      setEdits(null)
      setMessage('Dégustations enregistrées.')
    } catch (err) {
      setFailed(true)
      setMessage((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Dégustation</h2>
        <p className="text-sm text-slate-500">
          Note ce que tu goûtes, à plusieurs dates si tu veux voir la bière évoluer en bouteille.
        </p>
      </div>

      {tastings.length === 0 && <p className="text-sm text-slate-600">Aucune dégustation pour l’instant.</p>}
      {average !== null && (
        <p className="text-sm font-medium text-slate-700">Moyenne : {average.toLocaleString('fr-FR')} / 5</p>
      )}

      {tastings.map((tasting) => (
        <section key={tasting.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="block text-sm text-slate-600">
              Date
              <input
                type="date"
                value={tasting.date}
                onChange={(e) => e.target.value && patch(tasting.id, { date: e.target.value })}
                className="field-input mt-1"
              />
            </label>
            <fieldset>
              <legend className="text-sm text-slate-600">Note</legend>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold ${
                      tasting.rating === n ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`rating-${tasting.id}`}
                      aria-label={`${n} sur 5`}
                      checked={tasting.rating === n}
                      onChange={() => patch(tasting.id, { rating: n })}
                      className="sr-only"
                    />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={() => change(tastings.filter((t) => t.id !== tasting.id))}
              className="btn-secondary btn-sm"
              aria-label="Supprimer cette dégustation"
            >
              Supprimer
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((field) => (
              <label key={field.key} className="block text-sm text-slate-600">
                {field.label}
                <textarea
                  rows={2}
                  placeholder={field.placeholder}
                  value={tasting[field.key]}
                  onChange={(e) => patch(tasting.id, { [field.key]: e.target.value })}
                  className="field-input mt-1"
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => change([newTasting(todayIso(), newId()), ...tastings])}
          className="btn-secondary"
        >
          Ajouter une dégustation
        </button>
        <button type="button" onClick={save} disabled={saving || edits === null} className="btn-primary">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
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
