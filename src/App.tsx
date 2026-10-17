import { lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Login } from '@/pages/auth/Login'
import { Dashboard } from '@/pages/Dashboard'

/**
 * Pages chargées à la demande : chacune devient son propre fichier JS, téléchargé à la première visite
 * (le service worker les précharge ensuite pour le hors-ligne). Accueil et connexion restent dans le
 * fichier principal pour un premier affichage immédiat.
 */
function lazyPage<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] })))
}

const BatchLayout = lazyPage(() => import('@/components/batches/BatchLayout'), 'BatchLayout')
const BatchesHistory = lazyPage(() => import('@/pages/batches/BatchesHistory'), 'BatchesHistory')
const BatchesList = lazyPage(() => import('@/pages/batches/BatchesList'), 'BatchesList')
const BatchEditRecipe = lazyPage(() => import('@/pages/batches/BatchEditRecipe'), 'BatchEditRecipe')
const BatchFermentation = lazyPage(() => import('@/pages/batches/BatchFermentation'), 'BatchFermentation')
const BatchOverview = lazyPage(() => import('@/pages/batches/BatchOverview'), 'BatchOverview')
const BrewDay = lazyPage(() => import('@/pages/batches/BrewDay'), 'BrewDay')
const DevicesList = lazyPage(() => import('@/pages/devices/DevicesList'), 'DevicesList')
const EquipmentProfileDetail = lazyPage(() => import('@/pages/equipment-profiles/EquipmentProfileDetail'), 'EquipmentProfileDetail')
const EquipmentProfilesList = lazyPage(() => import('@/pages/equipment-profiles/EquipmentProfilesList'), 'EquipmentProfilesList')
const BrewfatherImport = lazyPage(() => import('@/pages/recipes/BrewfatherImport'), 'BrewfatherImport')
const RecipeDetail = lazyPage(() => import('@/pages/recipes/RecipeDetail'), 'RecipeDetail')
const RecipeEdit = lazyPage(() => import('@/pages/recipes/RecipeEdit'), 'RecipeEdit')
const RecipeImport = lazyPage(() => import('@/pages/recipes/RecipeImport'), 'RecipeImport')
const RecipeNew = lazyPage(() => import('@/pages/recipes/RecipeNew'), 'RecipeNew')
const RecipeValidate = lazyPage(() => import('@/pages/recipes/RecipeValidate'), 'RecipeValidate')
const RecipesList = lazyPage(() => import('@/pages/recipes/RecipesList'), 'RecipesList')
const StylesList = lazyPage(() => import('@/pages/styles/StylesList'), 'StylesList')
const Tools = lazyPage(() => import('@/pages/tools/Tools'), 'Tools')
const IngredientsGuide = lazyPage(() => import('@/pages/ingredients/IngredientsGuide'), 'IngredientsGuide')

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recipes" element={<RecipesList />} />
          <Route path="/recipes/new" element={<RecipeNew />} />
          <Route path="/recipes/import" element={<RecipeImport />} />
          <Route path="/recipes/brewfather" element={<BrewfatherImport />} />
          <Route path="/recipes/:recipeId" element={<RecipeDetail />} />
          <Route path="/recipes/:recipeId/edit" element={<RecipeEdit />} />
          <Route path="/recipes/:recipeId/validate" element={<RecipeValidate />} />
          <Route path="/batches" element={<BatchesList />} />
          <Route path="/batches/history" element={<BatchesHistory />} />
          <Route path="/batches/:batchId" element={<BatchLayout />}>
            <Route index element={<BatchOverview />} />
            <Route path="fermentation" element={<BatchFermentation />} />
            <Route path="edit-recipe" element={<BatchEditRecipe />} />
            <Route path="brew-day" element={<BrewDay />} />
          </Route>
          <Route path="/equipment-profiles" element={<EquipmentProfilesList />} />
          <Route path="/equipment-profiles/:profileId" element={<EquipmentProfileDetail />} />
          <Route path="/styles" element={<StylesList />} />
          <Route path="/devices" element={<DevicesList />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/ingredients" element={<IngredientsGuide />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
