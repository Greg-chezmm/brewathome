import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listRecipes } from '@/lib/db/queries/recipes'
import { BeerGlass } from '@/components/BeerGlass'

export function RecipesList() {
  const { data: recipes, isLoading, error } = useQuery({ queryKey: ['recipes'], queryFn: listRecipes })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes recettes</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/recipes/brewfather" className="btn-secondary">
            Brewfather
          </Link>
          <Link to="/recipes/import" className="btn-secondary">
            Importer un BeerXML
          </Link>
          <Link to="/recipes/new" className="btn-primary">
            Nouvelle recette
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-slate-500">Chargement…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      {recipes && recipes.length === 0 && <p className="text-slate-500">Aucune recette pour l'instant.</p>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes?.map((r) => (
          <li key={r.id}>
            <Link to={`/recipes/${r.id}`} className="card-link flex items-center gap-4">
              <BeerGlass srm={r.estSrm} size={48} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-semibold text-slate-900">{r.name}</h2>
                  <span className="badge shrink-0">{r.status}</span>
                </div>
                <p className="text-sm text-slate-500">
                  {r.estOg && `OG ${r.estOg.toFixed(3)} · `}
                  {r.estFg && `FG ${r.estFg.toFixed(3)} · `}
                  {r.estIbu !== null && `${r.estIbu.toFixed(0)} IBU · `}
                  {r.estSrm !== null && `${r.estSrm.toFixed(1)} SRM · `}
                  {r.estAbv !== null && `${r.estAbv.toFixed(1)}% ABV`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
