import { useEffect, useRef, useState, type ReactNode } from 'react'

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold leading-none text-slate-600 transition hover:bg-indigo-100 hover:text-indigo-700"
        aria-label="Aide sur ce champ"
      >
        ?
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-100 shadow-xl"
        >
          {text}
        </div>
      )}
    </span>
  )
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1 flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
      {hint && <InfoTooltip text={hint} />}
    </span>
  )
}
