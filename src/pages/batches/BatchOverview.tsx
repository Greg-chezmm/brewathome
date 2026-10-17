import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BatchSummaryTable } from '@/components/batches/BatchSummaryTable'
import { MeasurementsPanel } from '@/components/batches/MeasurementsPanel'
import { calculateABV_simple } from '@/lib/brew-calc/abv'
import { calculateFG } from '@/lib/brew-calc/gravity'
import {
  MEASUREMENTS,
  apparentAttenuation,
  batchSummary,
  plannedMeasurements,
  type MeasurementKey,
} from '@/lib/brew-day/measurements'
import {
  deleteBatch,
  getBatchWithDetails,
  updateBatchStatus,
  type BatchStatus,
} from '@/lib/db/queries/batches'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'

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
  const equipmentProfileId = batch?.recipeSnapshot.equipmentProfileId
  const { data: equipmentProfile } = useQuery({
    queryKey: ['equipment-profile', equipmentProfileId],
    queryFn: () => getEquipmentProfile(equipmentProfileId!),
    enabled: !!equipmentProfileId,
  })

  if (!batch) return <p className="text-slate-500">Chargement…</p>

  const recipe = batch.recipeSnapshot
  // Les outils (levure, resucrage…) s'ouvrent pré-remplis avec les valeurs du brassin.
  const toolsParams = new URLSearchParams()
  const toolsVolume = batch.volumeMeasuredL ?? recipe.targetVolumeL
  const toolsOg = batch.ogMeasured ?? recipe.estOg
  if (toolsVolume) toolsParams.set('volume', String(toolsVolume))
  if (toolsOg) toolsParams.set('og', String(toolsOg))
  if (recipe.yeasts[0]) {
    toolsParams.set('yeast', recipe.yeasts[0].style)
    toolsParams.set('form', recipe.yeasts[0].type)
  }
  const planned = plannedMeasurements(recipe, equipmentProfile)
  const { og, fg } = batch.measurements
  // DI mesurée sans DF : degré attendu en gardant l'atténuation prévue par la recette.
  const projectedAbv =
    og !== null && fg === null && planned.og !== null && planned.fg !== null
      ? calculateABV_simple(og, calculateFG(og, apparentAttenuation(planned.og, planned.fg)))
      : null

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
        <Link to={`/tools?${toolsParams}`} className="btn-secondary">
          Outils (levure, resucrage…)
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

      <MeasurementsPanel
        batchId={batch.id}
        fields={Object.keys(MEASUREMENTS) as MeasurementKey[]}
        measured={batch.measurements}
        planned={planned}
        recipe={recipe}
        equipment={equipmentProfile}
        title="Mesures du brassin"
      />

      <section className="card">
        <h2 className="section-title mb-1">Résumé : recette / brassin</h2>
        <p className="mb-3 text-sm text-slate-500">
          Saisissez les mesures au Brew Day (chaque étape propose les siennes) ou ci-dessus. Seules la DI et la DF sont
          indispensables ; volumes et densités intermédiaires donnent les efficacités réelles.
        </p>
        <BatchSummaryTable rows={batchSummary(recipe, equipmentProfile, batch.measurements)} />
        {projectedAbv !== null && (
          <p className="mt-3 text-sm text-slate-600">
            Avec la DI mesurée, alcool attendu : <strong>{projectedAbv.toFixed(1)} %</strong> (atténuation de la recette).
          </p>
        )}
      </section>
    </div>
  )
}
