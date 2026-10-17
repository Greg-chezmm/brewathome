import { NavLink } from 'react-router-dom'

const TABS: { path: string; label: string; end?: boolean }[] = [
  { path: '', label: 'Aperçu', end: true },
  { path: '/brew-day', label: 'Brew Day' },
  { path: '/fermentation', label: 'Fermentation' },
  { path: '/edit-recipe', label: 'Recette' },
]

/** Onglets d'un brassin : Aperçu, Brew Day, Fermentation, Recette. */
export function BatchTabs({ batchId }: { batchId: string }) {
  return (
    <nav aria-label="Sections du brassin" className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => (
        <NavLink
          key={tab.label}
          to={`/batches/${batchId}${tab.path}`}
          end={tab.end}
          className={({ isActive }) =>
            `-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
