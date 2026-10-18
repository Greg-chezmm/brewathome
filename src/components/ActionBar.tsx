import type { ReactNode } from 'react'

/**
 * Actions d'une page (Enregistrer, Modifier, Supprimer…), toujours au même endroit : barre collée en bas de
 * l'écran, au-dessus des onglets du bas sur mobile. À placer en dernier dans la page (ou dans le formulaire,
 * pour que le bouton submit en fasse partie). Actions principales à droite (la plus importante en dernier),
 * suppression à gauche.
 */
export function ActionBar({
  children,
  danger,
  aboveStatsBar = false,
}: {
  children?: ReactNode
  danger?: ReactNode
  /** Formulaire de recette : sur mobile, la barre des chiffres clés occupe déjà le bas, au-dessus des onglets. */
  aboveStatsBar?: boolean
}) {
  const bottom = aboveStatsBar ? 'bottom-[calc(7.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]'
  return (
    <div
      className={`sticky ${bottom} z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-900/10 backdrop-blur lg:bottom-4`}
    >
      {danger}
      <div className="ml-auto flex flex-wrap justify-end gap-2">{children}</div>
    </div>
  )
}
