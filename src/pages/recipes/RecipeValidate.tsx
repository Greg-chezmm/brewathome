import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { SessionsChoice } from '@/components/batches/SessionsChoice'
import { exceedsKettle } from '@/lib/brew-day/sessions'
import { createBatchFromRecipe } from '@/lib/db/queries/batches'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'
import { getRecipeWithDetails } from '@/lib/db/queries/recipes'

export function RecipeValidate() {
  const { recipeId } = useParams<{ recipeId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: recipe } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => getRecipeWithDetails(recipeId!),
    enabled: !!recipeId,
  })
  const equipmentProfileId = recipe?.equipmentProfileId
  const { data: equipmentProfile } = useQuery({
    queryKey: ['equipment-profile', equipmentProfileId],
    queryFn: () => getEquipmentProfile(equipmentProfileId!),
    enabled: !!equipmentProfileId,
  })

  const [name, setName] = useState('')
  const [brewDate, setBrewDate] = useState('')
  // Tant que l'utilisateur n'a pas choisi : 2 sessions si la recette déborde de la cuve.
  const [sessionsChoice, setSessionsChoice] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveName = name || recipe?.name || ''
  const brewSessions = sessionsChoice ?? (recipe && exceedsKettle(recipe, equipmentProfile) ? 2 : 1)

  async function handleValidate() {
    if (!user || !recipeId) return
    setSaving(true)
    setError(null)
    try {
      const batchId = await createBatchFromRecipe(user.id, recipeId, effectiveName, brewDate || null, brewSessions)
      navigate(`/batches/${batchId}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!recipe) return <p className="text-slate-500">Chargement…</p>

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Valider « {recipe.name} » en brassin</h1>
      <p className="text-slate-600">
        Une copie figée de la recette (ingrédients, stats estimées) sera enregistrée pour ce brassin. Les
        modifications ultérieures de la recette n'affecteront pas ce brassin.
      </p>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nom du brassin</label>
          <input
            value={effectiveName}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Date de brassage</label>
          <input
            type="date"
            value={brewDate}
            onChange={(e) => setBrewDate(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <SessionsChoice recipe={recipe} equipment={equipmentProfile} value={brewSessions} onChange={setSessionsChoice} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleValidate}
          disabled={saving}
          className="w-full rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? 'Création…' : 'Créer le brassin'}
        </button>
      </div>
    </div>
  )
}
