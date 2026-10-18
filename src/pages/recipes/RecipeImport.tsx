import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseBeerXML } from '@/lib/beerxml/import'
import type { ParsedRecipeDraft } from '@/lib/beerxml/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createRecipeFromDraft } from '@/lib/db/queries/recipes'

export function RecipeImport() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<ParsedRecipeDraft[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importingIndex, setImportingIndex] = useState<number | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = parseBeerXML(text)
    setRecipes(result.recipes)
    setParseErrors(result.errors.map((err) => `${err.recipeName ? `${err.recipeName} : ` : ''}${err.message}`))
  }

  async function handleImport(draft: ParsedRecipeDraft, index: number) {
    if (!user) return
    setImportError(null)
    setImportingIndex(index)
    try {
      const recipeId = await createRecipeFromDraft(user.id, draft)
      navigate(`/recipes/${recipeId}`)
    } catch (err) {
      setImportError((err as Error).message)
    } finally {
      setImportingIndex(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Importer un BeerXML</h1>
        <p className="text-slate-600">
          Sélectionnez un fichier .xml exporté depuis Little Bock, BeerSmith, Brewfather, etc.
        </p>
      </div>

      <label className="card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 bg-indigo-50/50 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50">
        <span className="text-2xl">📄</span>
        <span className="text-sm font-medium text-slate-900">Cliquez pour choisir un fichier .xml</span>
        <input type="file" accept=".xml" onChange={handleFileChange} className="hidden" />
      </label>

      {parseErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {parseErrors.map((msg) => (
            <p key={msg}>{msg}</p>
          ))}
        </div>
      )}

      {importError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{importError}</div>
      )}

      {recipes.length > 0 && (
        <ul className="space-y-3">
          {recipes.map((draft, index) => (
            <li key={`${draft.name}-${index}`} className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">{draft.name}</h2>
                  <p className="text-sm text-slate-500">
                    {draft.style?.name ?? 'Style non précisé'} · {draft.targetVolumeL} L · {draft.fermentables.length}{' '}
                    fermentescible(s), {draft.hops.length} houblon(s), {draft.yeasts.length} levure(s)
                  </p>
                  {draft.sourceEstimates.og && (
                    <p className="text-xs text-slate-400">
                      Annoncé par le fichier source : DI {draft.sourceEstimates.og.toFixed(3)}, IBU{' '}
                      {draft.sourceEstimates.ibu}, alcool {draft.sourceEstimates.abv} %
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={importingIndex !== null}
                  onClick={() => handleImport(draft, index)}
                  className="btn-primary shrink-0"
                >
                  {importingIndex === index ? 'Import…' : 'Importer'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
