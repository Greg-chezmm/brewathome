import { Link } from 'react-router-dom'
import type { FermentationStep } from '@/lib/brew-calc/fermentation-profile'

/** Écran de fin de Brew Day : ce qui suit (fermentation, mesure de la DF, embouteillage). */
export function BrewDayEnd({ batchId, fermentationSteps }: { batchId: string; fermentationSteps: FermentationStep[] }) {
  const totalDays = fermentationSteps.reduce((sum, s) => sum + s.days, 0)

  return (
    <div className="space-y-3 rounded-3xl bg-indigo-50 p-5 text-sm text-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Brassage terminé · et maintenant ?</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <strong>Fermentation</strong>
          {totalDays > 0 ? ` : environ ${totalDays} jours selon le profil de la recette.` : ' : laissez la levure travailler, à température stable.'}{' '}
          Ne soulevez pas le couvercle sans raison.
        </li>
        <li>
          <strong>Mesurez la densité finale (DF)</strong> quand la densité ne bouge plus pendant 2 à 3 jours de suite, jamais avant : mettre en bouteilles trop tôt les ferait exploser.
        </li>
        <li>
          <strong>Embouteillez</strong> : resucrage, remplissage, puis comptage des litres conditionnés.
        </li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Link to={`/batches/${batchId}/fermentation`} className="btn-primary">
          Suivi de fermentation →
        </Link>
        <Link to={`/batches/${batchId}/bottling`} className="btn-secondary">
          Embouteillage
        </Link>
      </div>
    </div>
  )
}
