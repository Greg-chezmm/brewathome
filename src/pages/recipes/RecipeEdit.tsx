import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EMPTY_RECIPE_FORM, RecipeForm, type RecipeFormValue } from '@/components/recipe/RecipeForm'
import { getRecipeWithDetails, updateRecipe } from '@/lib/db/queries/recipes'

export function RecipeEdit() {
  const { recipeId } = useParams<{ recipeId: string }>()
  const navigate = useNavigate()
  const [value, setValue] = useState<RecipeFormValue>(EMPTY_RECIPE_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recipeId) return
    getRecipeWithDetails(recipeId)
      .then((r) =>
        setValue({
          name: r.name,
          styleId: r.styleId,
          type: r.type,
          targetVolumeL: r.targetVolumeL,
          boilTimeMin: r.boilTimeMin,
          mashEfficiencyPercent: r.mashEfficiencyPercent,
          ibuFormula: r.ibuFormula,
          equipmentProfileId: r.equipmentProfileId,
          notes: r.notes ?? '',
          fermentables: r.fermentables,
          hops: r.hops,
          yeasts: r.yeasts,
        }),
      )
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [recipeId])

  async function handleSubmit() {
    if (!recipeId) return
    setSaving(true)
    setError(null)
    try {
      await updateRecipe(recipeId, { ...value, notes: value.notes || null })
      navigate(`/recipes/${recipeId}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-stone-500">Chargement…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-800">Modifier la recette</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <RecipeForm value={value} onChange={setValue} onSubmit={handleSubmit} saving={saving} submitLabel="Enregistrer" />
    </div>
  )
}
