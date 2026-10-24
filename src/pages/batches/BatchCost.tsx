import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { costRows, costSummary, serializeCosts, type CostRow } from '@/lib/batches/costs'
import { getBatchWithDetails, updateBatchCosts } from '@/lib/db/queries/batches'

const fmtEur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/** Montant saisi (virgule ou point) → nombre ; null si vide ou invalide. */
function parseAmount(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

interface Line {
  label: string
  detail: string
  amountText: string
  extra: boolean
}

const toLine = (row: CostRow): Line => ({
  label: row.label,
  detail: row.detail,
  amountText: row.amount === null ? '' : String(row.amount).replace('.', ','),
  extra: row.extra,
})

/**
 * Coût du brassin : prix de chaque ingrédient et frais libres (bouteilles, capsules, gaz…), saisis sur le brassin
 * (jamais sur la recette, dont les prix changent d'une année à l'autre).
 */
export function BatchCost() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })
  const [edits, setEdits] = useState<Line[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  if (!batch) return <p className="text-slate-500">Chargement…</p>

  const lines = edits ?? costRows(batch.recipeSnapshot, batch.costs).map(toLine)
  const change = (next: Line[]) => {
    setEdits(next)
    setMessage(null)
  }
  const patch = (index: number, changes: Partial<Line>) => change(lines.map((l, i) => (i === index ? { ...l, ...changes } : l)))

  const rows: CostRow[] = lines.map((l) => ({ label: l.label, detail: l.detail, amount: parseAmount(l.amountText), extra: l.extra }))
  const saved = serializeCosts(rows)
  const packaged = batch.measurements?.packagingVolumeL
  const litres =
    packaged && packaged > 0 ? packaged : batch.volumeMeasuredL && batch.volumeMeasuredL > 0 ? batch.volumeMeasuredL : batch.recipeSnapshot.targetVolumeL
  const summary = costSummary(saved, litres)
  const extraIndexes = lines.flatMap((l, i) => (l.extra ? [i] : []))

  async function save() {
    setSaving(true)
    setMessage(null)
    setFailed(false)
    try {
      await updateBatchCosts(batch!.id, saved)
      await queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      setEdits(null)
      setMessage('Coûts enregistrés.')
    } catch (err) {
      setFailed(true)
      setMessage((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ingrédients</h2>
          <p className="text-sm text-slate-500">Prix payé pour ce brassin (propre à ce brassin, pas à la recette).</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {lines.map((line, index) =>
            line.extra ? null : (
              <li key={`${line.label}-${index}`} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{line.label}</span>
                <span className="text-xs text-slate-400">{line.detail}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Prix de ${line.label}`}
                  placeholder="€"
                  value={line.amountText}
                  onChange={(e) => patch(index, { amountText: e.target.value })}
                  className="field-input w-24 text-right"
                />
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Autres frais</h2>
        <p className="text-sm text-slate-500">Bouteilles, capsules, gaz, sucre de refermentation…</p>
        {extraIndexes.map((lineIndex, n) => (
          <div key={lineIndex} className="flex items-center gap-2">
            <input
              type="text"
              aria-label={`Libellé du frais ${n + 1}`}
              placeholder="Libellé"
              value={lines[lineIndex].label}
              onChange={(e) => patch(lineIndex, { label: e.target.value })}
              className="field-input flex-1"
            />
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Montant du frais ${n + 1}`}
              placeholder="€"
              value={lines[lineIndex].amountText}
              onChange={(e) => patch(lineIndex, { amountText: e.target.value })}
              className="field-input w-24 text-right"
            />
            <button
              type="button"
              aria-label={`Supprimer le frais ${n + 1}`}
              onClick={() => change(lines.filter((_, i) => i !== lineIndex))}
              className="btn-secondary text-sm"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => change([...lines, { label: '', detail: '', amountText: '', extra: true }])}
          className="btn-secondary text-sm"
        >
          Ajouter un frais
        </button>
      </div>

      <div className="card space-y-1">
        <p className="text-lg font-semibold text-slate-900">Total : {fmtEur(summary.totalEur)}</p>
        {summary.perLitreEur !== null && summary.per33clEur !== null ? (
          <>
            <p className="text-sm text-slate-700">{fmtEur(summary.perLitreEur)} le litre</p>
            <p className="text-sm text-slate-700">{fmtEur(summary.per33clEur)} la bouteille de 33 cl</p>
            <p className="text-xs text-slate-400">Calculé sur {litres.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} L.</p>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Enregistrement…' : 'Enregistrer les coûts'}
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
