import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { calculateABV } from '@/lib/brew-calc/abv'
import {
  deleteBatch,
  getBatchWithDetails,
  updateBatchMeasurements,
  updateBatchStatus,
  type BatchStatus,
} from '@/lib/db/queries/batches'

const STATUS_FLOW: BatchStatus[] = ['planned', 'brew_day', 'fermentation', 'conditioning', 'completed']
const STATUS_LABELS: Record<BatchStatus, string> = {
  planned: 'Planifié',
  brew_day: 'Jour de brassage',
  fermentation: 'Fermentation',
  conditioning: 'Conditionnement',
  completed: 'Terminé',
}

export function BatchOverview() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })
  const [og, setOg] = useState('')
  const [fg, setFg] = useState('')

  if (!batch) return <p className="text-slate-500">Chargement…</p>

  const recipe = batch.recipeSnapshot
  const actualAbv =
    batch.ogMeasured !== null && batch.fgMeasured !== null ? calculateABV(batch.ogMeasured, batch.fgMeasured) : null

  async function advanceStatus() {
    if (!batchId) return
    const currentIndex = STATUS_FLOW.indexOf(batch!.status)
    const next = STATUS_FLOW[currentIndex + 1]
    if (!next) return
    await updateBatchStatus(batchId, next)
    queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
  }

  async function handleDelete() {
    if (!batchId) return
    if (!confirm('Supprimer définitivement ce brassin (étapes et lectures de fermentation incluses) ?')) return
    await deleteBatch(batchId)
    queryClient.invalidateQueries({ queryKey: ['batches'] })
    navigate('/batches')
  }

  async function saveMeasurements() {
    if (!batchId) return
    await updateBatchMeasurements(batchId, {
      ogMeasured: og ? Number.parseFloat(og) : undefined,
      fgMeasured: fg ? Number.parseFloat(fg) : undefined,
    })
    queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{batch.name}</h1>
          <p className="text-slate-500">{batch.brewDate ?? 'Date non définie'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge">{STATUS_LABELS[batch.status]}</span>
          <button onClick={handleDelete} className="btn-danger">
            Supprimer
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to={`/batches/${batchId}/brew-day`} className="btn-primary">
          Mode Brew Day
        </Link>
        <Link to={`/batches/${batchId}/fermentation`} className="btn-secondary">
          Suivi de fermentation
        </Link>
        {STATUS_FLOW.indexOf(batch.status) < STATUS_FLOW.length - 1 && (
          <button onClick={advanceStatus} className="btn-secondary">
            Passer à l'étape suivante ({STATUS_LABELS[STATUS_FLOW[STATUS_FLOW.indexOf(batch.status) + 1]]})
          </button>
        )}
      </div>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Recette (propre à ce brassin)</h2>
          <Link to={`/batches/${batchId}/edit-recipe`} className="btn-secondary btn-sm">
            Modifier
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          OG estimée {recipe.estOg?.toFixed(3)} · FG estimée {recipe.estFg?.toFixed(3)} · {recipe.estIbu?.toFixed(0)} IBU ·{' '}
          {recipe.estSrm?.toFixed(1)} SRM · {recipe.estAbv?.toFixed(1)}% ABV estimé
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Modifier ici n'affecte que ce brassin — la recette d'origine reste inchangée.
        </p>
      </section>

      <section className="card">
        <h2 className="section-title mb-2">Mesures réelles</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label">OG mesurée</label>
            <input
              type="number"
              step="0.001"
              defaultValue={batch.ogMeasured ?? ''}
              onChange={(e) => setOg(e.target.value)}
              className="field-input w-28"
            />
          </div>
          <div>
            <label className="field-label">FG mesurée</label>
            <input
              type="number"
              step="0.001"
              defaultValue={batch.fgMeasured ?? ''}
              onChange={(e) => setFg(e.target.value)}
              className="field-input w-28"
            />
          </div>
          <button onClick={saveMeasurements} className="btn-primary">
            Enregistrer
          </button>
        </div>
        {actualAbv !== null && <p className="mt-2 text-sm font-medium text-indigo-600">ABV réel calculé : {actualAbv.toFixed(2)}%</p>}
      </section>
    </div>
  )
}
