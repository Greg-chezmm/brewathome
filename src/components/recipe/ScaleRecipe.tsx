import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { listEquipmentProfiles } from '@/lib/db/queries/equipmentProfiles'
import { createRecipe, type RecipeDetails } from '@/lib/db/queries/recipes'
import { scaleRecipe } from '@/lib/recipe/scale'

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/**
 * « Redimensionner » : crée une copie de la recette à un autre volume (quantités proportionnelles), puis
 * l'ouvre dans l'éditeur. La recette d'origine ne bouge pas.
 */
export function ScaleRecipe({ recipe }: { recipe: RecipeDetails }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [volume, setVolume] = useState(String(recipe.targetVolumeL))
  const [name, setName] = useState<string | null>(null)
  const [equipmentId, setEquipmentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: profiles } = useQuery({ queryKey: ['equipment-profiles'], queryFn: listEquipmentProfiles, enabled: open })

  const newVolume = Number.parseFloat(volume.replace(',', '.'))
  const volumeValid = Number.isFinite(newVolume) && newVolume > 0 && recipe.targetVolumeL > 0
  const proposedName = volumeValid ? `${recipe.name} (${fmt(newVolume)} L)` : recipe.name
  const finalName = (name ?? proposedName).trim()
  const chosenEquipment = equipmentId ?? recipe.equipmentProfileId ?? ''

  async function create() {
    if (!user || !volumeValid || !finalName) return
    setSaving(true)
    setError(null)
    try {
      const input = scaleRecipe(recipe, newVolume, { name: finalName, equipmentProfileId: chosenEquipment || null })
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
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary" title="Créer une copie de cette recette à un autre volume">
        Redimensionner
      </button>
    )
  }

  return (
    <div className="w-full space-y-2 rounded-lg border border-slate-200 p-3 text-sm" aria-label="Redimensionner la recette">
      <p className="text-slate-600">
        Crée une copie aux quantités proportionnelles ({fmt(recipe.targetVolumeL)} L aujourd’hui). Densité et amertume restent les mêmes.
      </p>
      <label className="block text-slate-700">
        Nouveau volume (L)
        <input
          type="number"
          step="0.5"
          min="0"
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          className="field-input mt-1"
        />
      </label>
      {volumeValid && <p className="text-xs text-slate-500">Échelle ×{fmt(newVolume / recipe.targetVolumeL)}</p>}
      <label className="block text-slate-700">
        Nom
        <input value={name ?? proposedName} onChange={(e) => setName(e.target.value)} className="field-input mt-1" />
      </label>
      <label className="block text-slate-700">
        Équipement
        <select value={chosenEquipment} onChange={(e) => setEquipmentId(e.target.value)} className="field-input mt-1">
          <option value="">Aucun</option>
          {(profiles ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({fmt(p.targetBatchVolumeL)} L)
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={create} disabled={saving || !volumeValid || !finalName} className="btn-primary btn-sm">
          {saving ? 'Création…' : 'Créer et modifier'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">
          Annuler
        </button>
      </div>
    </div>
  )
}
