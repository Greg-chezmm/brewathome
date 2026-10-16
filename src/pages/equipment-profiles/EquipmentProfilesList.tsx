import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listEquipmentProfiles } from '@/lib/db/queries/equipmentProfiles'

export function EquipmentProfilesList() {
  const { data: profiles, isLoading, error } = useQuery({
    queryKey: ['equipment-profiles'],
    queryFn: listEquipmentProfiles,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-stone-800">Profils d'équipement</h1>
        <Link to="/equipment-profiles/new" className="btn-primary">
          Nouveau profil
        </Link>
      </div>

      {isLoading && <p className="text-stone-500">Chargement…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      {profiles && profiles.length === 0 && (
        <p className="text-stone-500">
          Aucun profil pour l'instant. Créez-en un pour décrire votre installation (volumes, pertes).
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {profiles?.map((p) => (
          <li key={p.id}>
            <Link to={`/equipment-profiles/${p.id}`} className="card-link">
              <h2 className="font-semibold text-amber-900">{p.name}</h2>
              <p className="text-sm text-stone-500">
                {p.targetBatchVolumeL} L cible · cuve {p.boilKettleVolumeL} L · ébullition {p.boilTimeMin} min ·
                efficacité {p.mashEfficiencyPercent}% · {p.method}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
