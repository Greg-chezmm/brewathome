import { Link } from 'react-router-dom'

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-stone-800">Tableau de bord</h1>
        <p className="text-stone-600">Bienvenue sur BrewAtHome — préparez vos recettes et suivez vos brassins.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/recipes/new" className="card-link">
          <h2 className="section-title">Nouvelle recette</h2>
          <p className="mt-1 text-sm text-stone-500">Créer une recette et calculer OG/FG/IBU/SRM/ABV.</p>
        </Link>
        <Link to="/recipes/import" className="card-link">
          <h2 className="section-title">Importer un BeerXML</h2>
          <p className="mt-1 text-sm text-stone-500">Récupérer vos recettes existantes.</p>
        </Link>
        <Link to="/batches" className="card-link">
          <h2 className="section-title">Mes brassins</h2>
          <p className="mt-1 text-sm text-stone-500">Suivre le brew day et la fermentation en cours.</p>
        </Link>
      </div>
    </div>
  )
}
