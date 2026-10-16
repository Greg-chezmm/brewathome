import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EMPTY_RECIPE_FORM, RecipeForm, type RecipeFormValue } from '@/components/recipe/RecipeForm'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createRecipe } from '@/lib/db/queries/recipes'

export function RecipeNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [value, setValue] = useState<RecipeFormValue>(EMPTY_RECIPE_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const id = await createRecipe(user.id, { ...value, notes: value.notes || null })
      navigate(`/recipes/${id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Nouvelle recette</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <RecipeForm value={value} onChange={setValue} onSubmit={handleSubmit} saving={saving} submitLabel="Créer la recette" />
    </div>
  )
}
