interface SessionTabsProps {
  brewSessions: number
  /** Session suivie ; null = toutes à la suite. */
  sessionFilter: number | null
  onSelect: (session: number | null) => void
}

/** Brassin en plusieurs sessions : un onglet par session, ou toutes à la suite. */
export function SessionTabs({ brewSessions, sessionFilter, onSelect }: SessionTabsProps) {
  return (
    <div className="mb-3 flex items-center gap-1 self-start rounded-full bg-slate-100 p-1 text-sm" role="group" aria-label="Session suivie">
      {[null, ...Array.from({ length: brewSessions }, (_, i) => i + 1)].map((session) => (
        <button
          key={session ?? 'all'}
          type="button"
          onClick={() => onSelect(session)}
          aria-pressed={sessionFilter === session}
          className={`rounded-full px-3 py-1.5 font-medium ${
            sessionFilter === session ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          {session === null ? 'Toutes' : `Session ${session}`}
        </button>
      ))}
    </div>
  )
}
