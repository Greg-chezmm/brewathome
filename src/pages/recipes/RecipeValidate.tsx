import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { ActionBar } from '@/components/ActionBar'
import { SessionsChoice } from '@/components/batches/SessionsChoice'
import { exceedsKettle } from '@/lib/brew-day/sessions'
import { CREATE_BATCH_PHASES, createBatchFromRecipe } from '@/lib/db/queries/batches'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'
import { getRecipeWithDetails } from '@/lib/db/queries/recipes'

/** Délai après lequel la création est signalée comme plus longue que d'habitude. */
const SLOW_CREATION_MS = 8000

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
  const [phase, setPhase] = useState(0)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveName = name || recipe?.name || ''
  const brewSessions = sessionsChoice ?? (recipe && exceedsKettle(recipe, equipmentProfile) ? 2 : 1)

  // Au-delà de quelques secondes, on rassure : la création enchaîne plusieurs écritures et reste normale.
  useEffect(() => {
    if (!saving) return
    const timer = setTimeout(() => setSlow(true), SLOW_CREATION_MS)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [saving])

  async function handleValidate() {
    if (!user || !recipeId) return
    setSaving(true)
    setPhase(0)
    setError(null)
    try {
      const batchId = await createBatchFromRecipe(user.id, recipeId, effectiveName, brewDate || null, brewSessions, setPhase)
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
        {saving && (
          <div role="status" className="space-y-1 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
            <p className="font-medium">
              {CREATE_BATCH_PHASES[phase]}… (étape {phase + 1}/{CREATE_BATCH_PHASES.length})
            </p>
            <p className="text-indigo-700">
              {slow
                ? 'Ça prend plus de temps que d’habitude : la connexion est lente. Ne quittez pas la page, le brassin s’ouvrira tout seul.'
                : 'Quelques secondes suffisent en général.'}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            Le brassin n’a pas pu être créé : {error}. Vous pouvez réessayer.
          </p>
        )}
      </div>

      <ActionBar>
        <button type="button" onClick={handleValidate} disabled={saving} className="btn-primary">
          {saving ? 'Création…' : 'Créer le brassin'}
        </button>
      </ActionBar>
    </div>
  )
}
