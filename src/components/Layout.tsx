import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { ArrowDownUp, Beer, BookOpen, Cpu, Ellipsis, House, Library, LogOut, Wrench, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { ensureStarterRecipe } from '@/lib/db/queries/starterRecipe'
import { BrewLogo } from '@/components/BrewLogo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/** Onglets principaux : barre du bas sur mobile, haut de la barre latérale sur PC. */
const primaryNav: NavItem[] = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/recipes', label: 'Recettes', icon: BookOpen },
  { to: '/batches', label: 'Brassins', icon: Beer },
]

/** Écrans secondaires : menu « Plus » sur mobile. */
const secondaryNav: NavItem[] = [
  { to: '/equipment-profiles', label: 'Équipement', icon: Wrench },
  { to: '/devices', label: 'Appareils', icon: Cpu },
  { to: '/recipes/brewfather', label: 'Brewfather', icon: ArrowDownUp },
  { to: '/styles', label: 'Styles BJCP', icon: Library },
]

export function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const queryClient = useQueryClient()

  // Nouveau compte : on lui offre une recette d'exemple (une Pale Ale) à la première connexion.
  useEffect(() => {
    if (!user) return
    ensureStarterRecipe(user)
      .then((created) => {
        if (created) void queryClient.invalidateQueries({ queryKey: ['recipes'] })
      })
      .catch((err) => console.warn('Recette d’exemple non créée :', err))
  }, [user, queryClient])
  // Le Brew Day occupe tout l'écran sur mobile (sa propre barre d'actions remplace les onglets).
  const immersive = useMatch('/batches/:batchId/brew-day') !== null
  const secondaryActive = secondaryNav.some((item) => location.pathname.startsWith(item.to))
  // Une entrée plus précise (Brewfather sous /recipes) prend la main : « Recettes » ne s'allume pas avec elle.
  const shadowed = (item: NavItem) =>
    [...primaryNav, ...secondaryNav].some((other) => other.to.startsWith(`${item.to}/`) && location.pathname.startsWith(other.to))

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 lg:flex">
      {/* Barre latérale — PC */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 px-3 py-5 lg:flex">
        <span className="mb-6 flex items-center gap-2 px-3 text-lg font-bold tracking-tight text-white">
          <BrewLogo size={28} />
          BrewAtHome
        </span>
        <nav className="flex flex-1 flex-col gap-1">
          {[...primaryNav, ...secondaryNav].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isActive && !shadowed(item) ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-3 pt-4 text-sm">
          <p className="truncate text-slate-400">{user?.email}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-2 flex items-center gap-2 font-medium text-slate-300 transition hover:text-white"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barre du haut — mobile */}
        {!immersive && (
          <header className="sticky top-0 z-20 flex items-center gap-2 bg-slate-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-sm lg:hidden">
            <BrewLogo size={24} />
            <span className="font-bold tracking-tight">BrewAtHome</span>
          </header>
        )}

        <main
          className={
            immersive
              ? 'mx-auto w-full max-w-6xl lg:px-8 lg:py-8'
              : 'mx-auto w-full max-w-5xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:py-10'
          }
        >
          <Outlet />
        </main>
      </div>

      {/* Onglets du bas — mobile */}
      {!immersive && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) => tabClass(isActive && !moreOpen && !shadowed(item))}
            >
              <item.icon size={22} />
              {item.label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMoreOpen((o) => !o)} className={tabClass(moreOpen || secondaryActive)}>
            <Ellipsis size={22} />
            Plus
          </button>
        </nav>
      )}

      {/* Menu « Plus » — mobile */}
      {moreOpen && !immersive && (
        <div className="fixed inset-0 z-20 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div
            className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] rounded-t-3xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-sm font-semibold text-slate-500">Plus</p>
              <button type="button" onClick={() => setMoreOpen(false)} className="rounded-full p-1 text-slate-400" aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            {secondaryNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium text-slate-700 active:bg-slate-100"
              >
                <item.icon size={20} className="text-indigo-500" />
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-slate-100 px-3 pt-3">
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
              <button
                type="button"
                onClick={() => signOut()}
                className="mt-1 flex items-center gap-3 py-2 font-medium text-red-600"
              >
                <LogOut size={20} />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function tabClass(active: boolean) {
  return `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
    active ? 'text-indigo-600' : 'text-slate-500'
  }`
}
