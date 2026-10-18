import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { measuredResults } from '@/lib/batches/apply-results'
import type { BatchDetails } from '@/lib/db/queries/batches'
import { updateEquipmentMashEfficiency, type EquipmentProfileRecord } from '@/lib/db/queries/equipmentProfiles'
import { applyResultsToRecipe, getRecipeWithDetails } from '@/lib/db/queries/recipes'

const pct = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`

/**
 * Reporte ce que le brassin a réellement donné (efficacité d'empâtage, atténuation de la levure)
 * sur la recette d'origine et le profil d'équipement : les prochaines DI et DF tombent juste.
 */
export function ApplyResultsCard({ batch, equipment }: { batch: BatchDetails; equipment: EquipmentProfileRecord | undefined }) {
  const queryClient = useQueryClient()
  const results = measuredResults(batch, equipment)
  const { data: source } = useQuery({
    queryKey: ['recipe', batch.recipeId],
    queryFn: () => getRecipeWithDetails(batch.recipeId!),
    enabled: !!batch.recipeId,
    retry: false,
  })
  const [toRecipe, setToRecipe] = useState(true)
  const [toEquipment, setToEquipment] = useState(true)
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  if (results.mashEfficiency === null && results.yeastAttenuation === null) return null

  const sourceYeast = source?.yeasts[0] ?? null
  const sameYeast = sourceYeast !== null && sourceYeast.name === results.yeastName
  const recipeTarget = source && (results.mashEfficiency !== null || (sameYeast && results.yeastAttenuation !== null))
  const equipmentTarget = equipment && results.mashEfficiency !== null
  const nothingChecked = !(recipeTarget && toRecipe) && !(equipmentTarget && toEquipment)

  async function apply() {
    setState('saving')
    try {
      if (recipeTarget && toRecipe) {
        await applyResultsToRecipe(source.id, {
          mashEfficiencyPercent: results.mashEfficiency ?? undefined,
          yeastAttenuationPercent: results.yeastAttenuation ?? undefined,
          yeastName: results.yeastName,
        })
        queryClient.invalidateQueries({ queryKey: ['recipe', source.id] })
        queryClient.invalidateQueries({ queryKey: ['recipes'] })
      }
      if (equipmentTarget && toEquipment) {
        await updateEquipmentMashEfficiency(equipment.id, results.mashEfficiency!)
        queryClient.invalidateQueries({ queryKey: ['equipment-profile', equipment.id] })
        queryClient.invalidateQueries({ queryKey: ['equipment-profiles'] })
      }
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <section className="card space-y-3" aria-label="Reporter les résultats mesurés">
      <div>
        <h2 className="section-title">Reporter les résultats mesurés</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ce que votre installation et votre levure ont réellement donné, pour que les prochaines DI et DF tombent juste.
        </p>
      </div>

      <dl className="space-y-1.5 text-sm">
        {results.mashEfficiency !== null && (
          <div className="flex flex-wrap justify-between gap-x-3">
            <dt className="text-slate-700">Efficacité d'empâtage</dt>
            <dd className="text-slate-500">
              {pct(results.plannedMashEfficiency)} prévus → <strong className="text-slate-900">{pct(results.mashEfficiency)}</strong>
            </dd>
          </div>
        )}
        {results.yeastAttenuation !== null && results.plannedYeastAttenuation !== null && (
          <div className="flex flex-wrap justify-between gap-x-3">
            <dt className="text-slate-700">Atténuation de {results.yeastName}</dt>
            <dd className="text-slate-500">
              {pct(results.plannedYeastAttenuation)} annoncés → <strong className="text-slate-900">{pct(results.yeastAttenuation)}</strong>
            </dd>
          </div>
        )}
      </dl>
      {results.yeastAttenuation !== null && results.attenuation !== null && results.yeastAttenuation !== results.attenuation && (
        <p className="text-xs text-slate-500">
          Atténuation apparente mesurée {pct(results.attenuation)} avec un empâtage à {results.mashTempC.toLocaleString('fr-FR')} °C :
          la levure reçoit {pct(results.yeastAttenuation)}, la recette retire ensuite l'effet de sa propre température d'empâtage.
        </p>
      )}

      <div className="space-y-1.5 text-sm">
        {recipeTarget ? (
          <label className="flex items-start gap-2 text-slate-700">
            <input type="checkbox" checked={toRecipe} onChange={(e) => setToRecipe(e.target.checked)} className="mt-1" />
            <span>
              Recette d'origine « {source.name} »
              {results.yeastAttenuation !== null && !sameYeast && (
                <span className="block text-xs text-slate-500">
                  Efficacité seulement : sa levure principale n'est plus {results.yeastName}.
                </span>
              )}
            </span>
          </label>
        ) : (
          <p className="text-xs text-slate-500">
            Ce brassin n'est lié à aucune recette (import Brewfather ou recette supprimée) : créez une nouvelle version de la
            recette pour reprendre ces résultats.
          </p>
        )}
        {equipmentTarget && (
          <label className="flex items-start gap-2 text-slate-700">
            <input type="checkbox" checked={toEquipment} onChange={(e) => setToEquipment(e.target.checked)} className="mt-1" />
            <span>
              Profil d'équipement « {equipment.name} » ({pct(equipment.mashEfficiencyPercent)} → {pct(results.mashEfficiency!)})
              <span className="block text-xs text-slate-500">Les nouvelles recettes avec ce profil partiront de cette efficacité.</span>
            </span>
          </label>
        )}
      </div>

      {(recipeTarget || equipmentTarget) && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={apply} disabled={nothingChecked || state === 'saving'} className="btn-primary btn-sm">
            {state === 'saving' ? 'Enregistrement…' : 'Appliquer'}
          </button>
          {state === 'done' && <span className="text-sm text-emerald-700">Résultats reportés.</span>}
          {state === 'error' && <span className="text-sm text-red-600">Échec de l'enregistrement, réessayez.</span>}
        </div>
      )}
    </section>
  )
}
