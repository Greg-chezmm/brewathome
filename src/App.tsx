import { Navigate, Route, Routes } from 'react-router-dom'
import { BatchLayout } from '@/components/batches/BatchLayout'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Login } from '@/pages/auth/Login'
import { BatchesList } from '@/pages/batches/BatchesList'
import { BatchEditRecipe } from '@/pages/batches/BatchEditRecipe'
import { BatchFermentation } from '@/pages/batches/BatchFermentation'
import { BatchOverview } from '@/pages/batches/BatchOverview'
import { BrewDay } from '@/pages/batches/BrewDay'
import { Dashboard } from '@/pages/Dashboard'
import { DevicesList } from '@/pages/devices/DevicesList'
import { EquipmentProfileDetail } from '@/pages/equipment-profiles/EquipmentProfileDetail'
import { EquipmentProfilesList } from '@/pages/equipment-profiles/EquipmentProfilesList'
import { BrewfatherImport } from '@/pages/recipes/BrewfatherImport'
import { RecipeDetail } from '@/pages/recipes/RecipeDetail'
import { RecipeEdit } from '@/pages/recipes/RecipeEdit'
import { RecipeImport } from '@/pages/recipes/RecipeImport'
import { RecipeNew } from '@/pages/recipes/RecipeNew'
import { RecipeValidate } from '@/pages/recipes/RecipeValidate'
import { RecipesList } from '@/pages/recipes/RecipesList'
import { StylesList } from '@/pages/styles/StylesList'
import { Tools } from '@/pages/tools/Tools'

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
          <Route path="/batches/:batchId" element={<BatchLayout />}>
            <Route index element={<BatchOverview />} />
            <Route path="fermentation" element={<BatchFermentation />} />
            <Route path="edit-recipe" element={<BatchEditRecipe />} />
          </Route>
          <Route path="/batches/:batchId/brew-day" element={<BrewDay />} />
          <Route path="/equipment-profiles" element={<EquipmentProfilesList />} />
          <Route path="/equipment-profiles/:profileId" element={<EquipmentProfileDetail />} />
          <Route path="/styles" element={<StylesList />} />
          <Route path="/devices" element={<DevicesList />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
