import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { BrewLogo } from '@/components/BrewLogo'

const navItems = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/recipes', label: 'Recettes' },
  { to: '/batches', label: 'Brassins' },
  { to: '/equipment-profiles', label: 'Équipement' },
  { to: '/styles', label: 'Styles BJCP' },
]

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-[#fdf8f1] text-stone-900">
      <header className="sticky top-0 z-10 border-b border-amber-900/10 bg-gradient-to-r from-amber-900 via-amber-800 to-orange-800 shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-amber-50">
            <BrewLogo size={30} />
            <span className="font-display">BrewAtHome</span>
          </span>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-50 text-amber-900 shadow-sm'
                      : 'text-amber-100 hover:bg-amber-50/15'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-amber-100">
            <span className="hidden sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-full border border-amber-100/30 px-3 py-1.5 font-medium text-amber-50 transition hover:bg-amber-50/15"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
