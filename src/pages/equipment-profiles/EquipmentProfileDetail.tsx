import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  DEFAULT_EQUIPMENT_PROFILE,
  createEquipmentProfile,
  deleteEquipmentProfile,
  getEquipmentProfile,
  updateEquipmentProfile,
} from '@/lib/db/queries/equipmentProfiles'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { FieldLabel } from '@/components/InfoTooltip'

const FIELDS: Array<{ key: keyof EquipmentProfile; label: string; step?: string; hint: string }> = [
  { key: 'name', label: 'Nom', hint: 'Un nom pour reconnaître ce profil (ex : "Cuve 30L BIAB").' },
  {
    key: 'targetBatchVolumeL',
    label: 'Volume de brassin cible (L)',
    step: '0.1',
    hint: 'Volume final habituel que vous obtenez dans le fermenteur avec ce matériel. Sert de valeur par défaut pour vos nouvelles recettes.',
  },
  {
    key: 'boilKettleVolumeL',
    label: "Volume de la cuve d'ébullition (L)",
    step: '0.1',
    hint: "Capacité maximale de votre cuve. L'app vous alerte si le volume pré-ébullition d'une recette dépasse cette capacité.",
  },
  {
    key: 'boilTimeMin',
    label: "Durée d'ébullition (min)",
    step: '1',
    hint: "Durée habituelle de l'ébullition avec ce matériel — utilisée pour calculer l'évaporation totale.",
  },
  {
    key: 'evaporationRatePercentPerHour',
    label: "Taux d'évaporation (%/h)",
    step: '0.1',
    hint: "Pourcentage du volume en cuve qui s'évapore chaque heure d'ébullition. Dépend de la puissance de chauffe et de la largeur de la cuve. Typique : 8-15%/h. Mesurez le vôtre en comparant un volume avant/après une ébullition d'1h.",
  },
  {
    key: 'grainAbsorptionLPerKg',
    label: 'Absorption du grain (L/kg)',
    step: '0.01',
    hint: "Volume d'eau retenu par le grain gorgé d'eau après empâtage/rinçage, par kg de grain. Typique : 0,8-1,1 L/kg.",
  },
  {
    key: 'waterToGrainRatioLPerKg',
    label: 'Ratio eau/grain à l’empâtage (L/kg)',
    step: '0.1',
    hint: "Volume d'eau visé pour l'empâtage, par kg de grain (un empâtage \"épais\" utilise moins d'eau, ex. 2,5 L/kg ; \"fin\" davantage, ex. 3,5-4 L/kg). Le reste de l'eau totale nécessaire part au rinçage. Typique : 3 L/kg.",
  },
  {
    key: 'hopAbsorptionL',
    label: 'Absorption houblon/trub (L)',
    step: '0.1',
    hint: "Volume de moût perdu dans les résidus de houblon et de protéines coagulées (trub) au fond de la cuve en fin d'ébullition.",
  },
  {
    key: 'deadspaceL',
    label: 'Deadspace de cuve (L)',
    step: '0.1',
    hint: "Volume mort au fond de la cuve qui ne peut pas être soutiré (sous le niveau de la crépine ou du robinet).",
  },
  {
    key: 'thermalShrinkagePercent',
    label: 'Contraction thermique (%)',
    step: '0.1',
    hint: "Le moût se contracte en refroidissant (le liquide chaud est plus volumineux). Valeur standard : 4%.",
  },
  {
    key: 'mashEfficiencyPercent',
    label: 'Efficacité de brassage (%)',
    step: '0.1',
    hint: "Efficacité moyenne d'extraction des sucres avec ce matériel — valeur par défaut reprise dans vos nouvelles recettes.",
  },
]

export function EquipmentProfileDetail() {
  const { profileId } = useParams<{ profileId: string }>()
  const isNew = profileId === 'new'
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<EquipmentProfile>(DEFAULT_EQUIPMENT_PROFILE)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew || !profileId) return
    getEquipmentProfile(profileId)
      .then(setProfile)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [isNew, profileId])

  function updateField(key: keyof EquipmentProfile, value: string) {
    setProfile((p) => ({
      ...p,
      [key]: key === 'name' || key === 'method' ? value : Number.parseFloat(value),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const id = await createEquipmentProfile(user.id, profile)
        navigate(`/equipment-profiles/${id}`)
      } else if (profileId) {
        await updateEquipmentProfile(profileId, profile)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!profileId || isNew) return
    if (!confirm('Supprimer ce profil d’équipement ?')) return
    await deleteEquipmentProfile(profileId)
    navigate('/equipment-profiles')
  }

  if (loading) return <p className="text-slate-500">Chargement…</p>

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        {isNew ? 'Nouveau profil d’équipement' : profile.name}
      </h1>

      <form onSubmit={handleSubmit} className="card space-y-3">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <FieldLabel hint={field.hint}>{field.label}</FieldLabel>
            <input
              type={field.key === 'name' ? 'text' : 'number'}
              step={field.step}
              value={String(profile[field.key])}
              onChange={(e) => updateField(field.key, e.target.value)}
              required
              className="field-input"
            />
          </div>
        ))}

        <div>
          <FieldLabel hint="Méthode de brassage habituelle avec ce matériel.">Méthode</FieldLabel>
          <select
            value={profile.method}
            onChange={(e) => setProfile((p) => ({ ...p, method: e.target.value as EquipmentProfile['method'] }))}
            className="field-input"
          >
            <option value="all-grain">Tout-grain</option>
            <option value="biab">BIAB</option>
            <option value="extract">Extrait</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {!isNew && (
            <button type="button" onClick={handleDelete} className="btn-danger">
              Supprimer
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
