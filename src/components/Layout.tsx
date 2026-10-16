import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { BrewLogo } from '@/components/BrewLogo'

const navItems = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/recipes', label: 'Recettes' },
  { to: '/batches', label: 'Brassins' },
  { to: '/equipment-profiles', label: 'Équipement' },
  { to: '/devices', label: 'Appareils' },
  { to: '/styles', label: 'Styles BJCP' },
]

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3.5">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
            <BrewLogo size={28} />
            BrewAtHome
          </span>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 font-medium transition-colors ${
                    isActive ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="hidden sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-full border border-slate-700 px-3 py-1.5 font-medium text-slate-200 transition hover:bg-white/5"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
