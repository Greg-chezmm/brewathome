import { useState } from 'react'
import bjcpStyles from '@/data/bjcp-styles-2021.json'

export function StylesList() {
  const [query, setQuery] = useState('')
  const filtered = bjcpStyles.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold text-stone-800">Styles BJCP 2021</h1>
      <input
        placeholder="Rechercher un style…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="field-input max-w-sm"
      />
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-amber-100 text-left text-amber-900">
            <tr>
              <th className="px-3 py-2">Style</th>
              <th className="px-3 py-2">OG</th>
              <th className="px-3 py-2">FG</th>
              <th className="px-3 py-2">IBU</th>
              <th className="px-3 py-2">SRM</th>
              <th className="px-3 py-2">ABV</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-stone-100">
                <td className="px-3 py-2 font-medium text-stone-800">
                  {s.categoryNumber}
                  {s.styleLetter ?? ''} · {s.name}
                </td>
                <td className="px-3 py-2 text-stone-600">
                  {s.ogMin}–{s.ogMax}
                </td>
                <td className="px-3 py-2 text-stone-600">
                  {s.fgMin}–{s.fgMax}
                </td>
                <td className="px-3 py-2 text-stone-600">
                  {s.ibuMin}–{s.ibuMax}
                </td>
                <td className="px-3 py-2 text-stone-600">
                  {s.srmMin}–{s.srmMax}
                </td>
                <td className="px-3 py-2 text-stone-600">
                  {s.abvMin}–{s.abvMax}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
