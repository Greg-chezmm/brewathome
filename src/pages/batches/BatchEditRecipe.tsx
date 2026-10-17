import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { EMPTY_RECIPE_FORM, RecipeForm, type RecipeFormValue } from '@/components/recipe/RecipeForm'
import { getBatchWithDetails, updateBatchRecipeSnapshot } from '@/lib/db/queries/batches'

export function BatchEditRecipe() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })

  const [value, setValue] = useState<RecipeFormValue>(EMPTY_RECIPE_FORM)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!batch || loaded) return
    const r = batch.recipeSnapshot
    setValue({
      name: r.name,
      styleId: r.styleId,
      type: r.type,
      targetVolumeL: r.targetVolumeL,
      boilTimeMin: r.boilTimeMin,
      mashEfficiencyPercent: r.mashEfficiencyPercent,
      mashTempC: r.mashTempC,
      mashSteps: r.mashSteps,
      ibuFormula: r.ibuFormula,
      equipmentProfileId: r.equipmentProfileId,
      notes: r.notes ?? '',
      fermentables: r.fermentables,
      hops: r.hops,
      yeasts: r.yeasts,
      otherIngredients: r.otherIngredients ?? [],
    })
    setLoaded(true)
  }, [batch, loaded])

  async function handleSubmit() {
    if (!batchId || !batch) return
    setSaving(true)
    setError(null)
    try {
      await updateBatchRecipeSnapshot(batchId, batch.recipeSnapshot, { ...value, notes: value.notes || null })
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
      navigate(`/batches/${batchId}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!batch || !loaded) return <p className="text-slate-500">Chargement…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Modifier la recette de « {batch.name} »</h1>
        <p className="text-slate-500">
          Ces changements ne s'appliquent qu'à ce brassin — la recette d'origine (si elle existe encore) n'est pas
          modifiée.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <RecipeForm
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        saving={saving}
        submitLabel="Enregistrer pour ce brassin"
      />
    </div>
  )
}
