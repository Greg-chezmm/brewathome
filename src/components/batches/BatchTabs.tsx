import { NavLink } from 'react-router-dom'

const TABS: { path: string; label: string; end?: boolean }[] = [
  { path: '', label: 'Aperçu', end: true },
  { path: '/brew-day', label: 'Brew Day' },
  { path: '/fermentation', label: 'Fermentation' },
  { path: '/edit-recipe', label: 'Recette' },
]

const VARIANTS = {
  /** Sur le fond clair des pages du brassin. */
  light: {
    nav: 'border-slate-200',
    active: 'border-indigo-600 text-indigo-700',
    idle: 'border-transparent text-slate-500 hover:text-slate-800',
  },
  /** Dans l'en-tête sombre du Brew Day. */
  dark: {
    nav: 'border-white/10',
    active: 'border-indigo-400 text-white',
    idle: 'border-transparent text-slate-400 hover:text-white',
  },
}

/** Onglets d'un brassin, partagés par ses pages et par le Brew Day plein écran. */
export function BatchTabs({ batchId, variant = 'light' }: { batchId: string; variant?: keyof typeof VARIANTS }) {
  const styles = VARIANTS[variant]
  return (
    <nav aria-label="Sections du brassin" className={`flex gap-1 overflow-x-auto border-b ${styles.nav}`}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.label}
          to={`/batches/${batchId}${tab.path}`}
          end={tab.end}
          className={({ isActive }) =>
            `-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? styles.active : styles.idle}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
