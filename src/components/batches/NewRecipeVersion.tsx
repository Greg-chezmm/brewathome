import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { measuredResults } from '@/lib/batches/apply-results'
import { nextVersionName, recipeInputFromSnapshot } from '@/lib/batches/new-version'
import type { BatchDetails } from '@/lib/db/queries/batches'
import type { EquipmentProfileRecord } from '@/lib/db/queries/equipmentProfiles'
import { createRecipe, listRecipes } from '@/lib/db/queries/recipes'

/**
 * « Nouvelle version de la recette » : une recette créée depuis celle du brassin (avec ses
 * retouches), éventuellement corrigée de ses résultats mesurés, ouverte ensuite dans l'éditeur.
 */
export function NewRecipeVersion({
  batch,
  equipment,
  equipmentLoading = false,
}: {
  batch: BatchDetails
  equipment: EquipmentProfileRecord | undefined
  /** Profil encore en chargement : ne pas le prendre pour supprimé (il serait retiré de la recette). */
  equipmentLoading?: boolean
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: recipes } = useQuery({ queryKey: ['recipes'], queryFn: listRecipes })
  const [open, setOpen] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [withResults, setWithResults] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const snapshot = batch.recipeSnapshot
  const results = measuredResults(batch, equipment)
  const hasResults = results.mashEfficiency !== null || results.yeastAttenuation !== null
  const proposedName = nextVersionName(snapshot.name, recipes?.map((r) => r.name))
  const finalName = (name ?? proposedName).trim()

  async function create() {
    if (!user || !finalName) return
    setSaving(true)
    setError(null)
    try {
      const input = recipeInputFromSnapshot(snapshot, {
        name: finalName,
        origin: { name: batch.name, date: batch.brewDate },
        results: hasResults && withResults ? results : null,
        keepEquipment: !snapshot.equipmentProfileId || !!equipment,
      })
      const id = await createRecipe(user.id, input)
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      navigate(`/recipes/${id}/edit`)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        Nouvelle version de la recette
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm" aria-label="Nouvelle version de la recette">
      <p className="text-slate-600">
        Crée une recette à partir de celle de ce brassin (retouches comprises), à ajuster pour le prochain brassin.
      </p>
      <label className="block text-slate-700">
        Nom
        <input value={name ?? proposedName} onChange={(e) => setName(e.target.value)} className="field-input mt-1" />
      </label>
      {hasResults && (
        <label className="flex items-start gap-2 text-slate-700">
          <input type="checkbox" checked={withResults} onChange={(e) => setWithResults(e.target.checked)} className="mt-1" />
          <span>
            Intégrer les résultats mesurés
            <span className="block text-xs text-slate-500">
              {[
                results.mashEfficiency !== null && `efficacité ${results.mashEfficiency.toLocaleString('fr-FR')} %`,
                results.yeastAttenuation !== null && `atténuation de ${results.yeastName} ${results.yeastAttenuation.toLocaleString('fr-FR')} %`,
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          </span>
        </label>
      )}
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={create} disabled={saving || !finalName || equipmentLoading} className="btn-primary btn-sm">
          {saving ? 'Création…' : 'Créer et modifier'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">
          Annuler
        </button>
      </div>
    </div>
  )
}
