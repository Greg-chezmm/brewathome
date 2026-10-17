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

const FIELDS: Array<{ key: keyof EquipmentProfile; label: string; step?: string; hint: string; optional?: boolean }> = [
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
    key: 'mashTunVolumeL',
    label: "Volume de la cuve d'empâtage (L)",
    step: '0.1',
    optional: true,
    hint: "Capacité de la cuve d'empâtage, pour vérifier qu'eau + grain y tiennent. Laissez vide en BIAB (c'est la cuve d'ébullition qui compte).",
  },
  {
    key: 'boilTimeMin',
    label: "Durée d'ébullition habituelle (min)",
    step: '1',
    hint: "Valeur par défaut des nouvelles recettes. Les calculs utilisent la durée d'ébullition de chaque recette.",
  },
  {
    key: 'evaporationRateLPerHour',
    label: "Évaporation (L/h)",
    step: '0.1',
    hint: "Litres perdus par heure d'ébullition. Dépend de la puissance de chauffe et de la largeur de la cuve, pas du volume. Mesurez-la : volume avant − volume après une ébullition d'1 h. Typique : 2-5 L/h.",
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
    key: 'mashTunDeadspaceL',
    label: "Perte cuve d'empâtage (L)",
    step: '0.1',
    hint: "Volume mort sous le faux-fond de la cuve d'empâtage, jamais récupéré : l'app le rajoute à l'eau totale. 0 en BIAB.",
  },
  {
    key: 'hopAbsorptionL',
    label: 'Pertes houblon/trub (L)',
    step: '0.1',
    hint: "Volume de moût perdu dans les résidus de houblon et de protéines coagulées (trub) au fond de la cuve en fin d'ébullition.",
  },
  {
    key: 'deadspaceL',
    label: "Volume mort cuve d'ébullition / refroidisseur (L)",
    step: '0.1',
    hint: "Moût qui reste dans la cuve (sous le robinet) ou dans le refroidisseur. Avec les pertes houblon/trub, c'est ce qui sépare la fin d'ébullition du fermenteur.",
  },
  {
    key: 'fermenterLossL',
    label: 'Perte au fermenteur (L)',
    step: '0.1',
    hint: 'Lie et bière laissée au soutirage : le volume embouteillé = volume en fermenteur − cette perte.',
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
  {
    key: 'hopUtilizationPercent',
    label: 'Utilisation houblon (%)',
    step: '1',
    hint: "Facteur correcteur de l'amertume des houblons en ébullition. 100 % = formule (Tinseth ou Garetz) telle quelle. Baissez-le si vos bières sont régulièrement moins amères que prévu (sac à houblon, cuve étroite…).",
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
      [key]:
        key === 'name' || key === 'method'
          ? value
          : key === 'mashTunVolumeL' && value === ''
            ? null
            : Number.parseFloat(value),
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
              value={String(profile[field.key] ?? '')}
              onChange={(e) => updateField(field.key, e.target.value)}
              required={!field.optional}
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
