import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ActionBar } from '@/components/ActionBar'
import { ApplyResultsCard } from '@/components/batches/ApplyResultsCard'
import { BatchSummaryTable } from '@/components/batches/BatchSummaryTable'
import { MeasurementsPanel } from '@/components/batches/MeasurementsPanel'
import { NewRecipeVersion } from '@/components/batches/NewRecipeVersion'
import { SessionsChoice } from '@/components/batches/SessionsChoice'
import { calculateFG } from '@/lib/brew-calc/gravity'
import {
  MEASUREMENTS,
  apparentAttenuation,
  batchSummary,
  effectiveOg,
  fermentationAbvNote,
  measuredAbv,
  plannedMeasurements,
  type MeasurementKey,
} from '@/lib/brew-day/measurements'
import { SESSION_MEASUREMENT_KEYS, SESSION_MEASUREMENT_LABELS, sessionRecipe } from '@/lib/brew-day/sessions'
import {
  deleteBatch,
  getBatchWithDetails,
  updateBatchBrewSessions,
  updateBatchSessionMeasurements,
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
  const { data: equipmentProfile, isLoading: equipmentLoading } = useQuery({
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
  const sessions = batch.brewSessions
  const planned = plannedMeasurements(recipe, equipmentProfile, sessions)
  const part = sessionRecipe(recipe, sessions)
  const plannedSession = sessions > 1 ? plannedMeasurements(part, equipmentProfile) : null
  // En plusieurs sessions, volumes et densités avant/après ébullition se saisissent par session (le brassin en a les totaux).
  const batchFields = (Object.keys(MEASUREMENTS) as MeasurementKey[]).filter(
    (key) => sessions === 1 || key === 'fermenterVolumeL' || !(SESSION_MEASUREMENT_KEYS as readonly MeasurementKey[]).includes(key),
  )
  const { og, fg, fermenterVolumeL } = batch.measurements
  // DI mesurée sans DF : degré attendu en gardant l'atténuation prévue par la recette,
  // depuis la DI effective (sucre ajouté en fermentation compris).
  const projected =
    og !== null && fg === null && planned.og !== null && planned.fg !== null
      ? measuredAbv(
          recipe,
          og,
          calculateFG(
            effectiveOg(recipe, og, fermenterVolumeL),
            apparentAttenuation(effectiveOg(recipe, planned.og, planned.fermenterVolumeL), planned.fg),
          ),
          fermenterVolumeL,
        )
      : null
  const projectedNote = fermentationAbvNote(projected?.fermentationAbv)

  async function advanceStatus() {
    if (!batchId) return
    const currentIndex = STATUS_FLOW.indexOf(batch!.status)
    const next = STATUS_FLOW[currentIndex + 1]
    if (!next) return
    await updateBatchStatus(batchId, next)
    queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
  }

  async function changeSessions(brewSessions: number) {
    if (!batchId) return
    await updateBatchBrewSessions(batchId, recipe, brewSessions)
    queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
    queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
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
      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Recette (propre à ce brassin)</h2>
          <Link to={`/batches/${batchId}/edit-recipe`} className="btn-secondary btn-sm">
            Modifier
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          DI estimée {recipe.estOg?.toFixed(3)} · DF estimée {recipe.estFg?.toFixed(3)} · {recipe.estIbu?.toFixed(0)} IBU ·{' '}
          {recipe.estSrm?.toFixed(1)} SRM · alcool estimé {recipe.estAbv?.toFixed(1)} %
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Modifier ici n'affecte que ce brassin — la recette d'origine reste inchangée.
        </p>
        <div className="mt-3">
          <NewRecipeVersion batch={batch} equipment={equipmentProfile} equipmentLoading={equipmentLoading} />
        </div>
      </section>

      {(batch.status === 'planned' || sessions > 1) && (
        <section className="card">
          <h2 className="section-title mb-2">Sessions de brassage</h2>
          <SessionsChoice
            recipe={recipe}
            equipment={equipmentProfile}
            value={sessions}
            onChange={changeSessions}
            disabled={batch.status !== 'planned'}
          />
          {sessions > 1 && (
            <p className="mt-2 text-xs text-slate-500">
              Au Brew Day, suivez une session par onglet (ou passez de l'une à l'autre) : chacune a son ébullition et ses mesures.
            </p>
          )}
        </section>
      )}

      <MeasurementsPanel
        batchId={batch.id}
        fields={batchFields}
        measured={batch.measurements}
        planned={planned}
        recipe={recipe}
        equipment={equipmentProfile}
        title="Mesures du brassin"
      />

      {plannedSession &&
        batch.sessionMeasurements.map((measured, index) => (
          <MeasurementsPanel
            key={index}
            batchId={batch.id}
            fields={[...SESSION_MEASUREMENT_KEYS]}
            measured={{ ...batch.measurements, ...measured }}
            planned={plannedSession}
            recipe={part}
            equipment={equipmentProfile}
            labels={SESSION_MEASUREMENT_LABELS}
            title={`Mesures de la session ${index + 1}`}
            onSave={(changes) => updateBatchSessionMeasurements(batch.id, index, changes)}
          />
        ))}

      <section className="card">
        <h2 className="section-title mb-1">Résumé : recette / brassin</h2>
        <p className="mb-3 text-sm text-slate-500">
          Saisissez les mesures au Brew Day (chaque étape propose les siennes) ou ci-dessus. Seules la DI et la DF sont
          indispensables ; volumes et densités intermédiaires donnent les efficacités réelles.
        </p>
        <BatchSummaryTable rows={batchSummary(recipe, equipmentProfile, batch.measurements, sessions)} />
        {projected !== null && (
          <p className="mt-3 text-sm text-slate-600">
            Avec la DI mesurée, alcool attendu : <strong>{projected.abv.toFixed(1)} %</strong> (atténuation de la recette
            {projectedNote && `, ${projectedNote}`}).
          </p>
        )}
      </section>

      <ApplyResultsCard batch={batch} equipment={equipmentProfile} />

      <ActionBar
        danger={
          <button type="button" onClick={handleDelete} className="btn-danger">
            Supprimer
          </button>
        }
      >
        <Link to={`/tools?${toolsParams}`} className="btn-secondary">
          Outils (levure, resucrage…)
        </Link>
        {STATUS_FLOW.indexOf(batch.status) < STATUS_FLOW.length - 1 && (
          <button type="button" onClick={advanceStatus} className="btn-secondary">
            Passer à l'étape suivante ({STATUS_LABELS[STATUS_FLOW[STATUS_FLOW.indexOf(batch.status) + 1]]})
          </button>
        )}
        {(batch.status === 'planned' || batch.status === 'brew_day') && (
          <Link to={`/batches/${batchId}/brew-day`} className="btn-primary">
            Lancer le Brew Day
          </Link>
        )}
      </ActionBar>
    </div>
  )
}
