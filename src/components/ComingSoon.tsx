export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
      <h1 className="mb-2 text-xl font-semibold text-slate-700">{title}</h1>
      <p>Cette page sera implémentée dans une prochaine étape.</p>
    </div>
  )
}
