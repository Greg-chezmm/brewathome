-- Row Level Security : chaque utilisateur ne voit/modifie que ses propres
-- données. bjcp_styles est une table de référence partagée, en lecture seule
-- pour les clients (les écritures se font uniquement via migration/seed).

-- equipment_profiles
ALTER TABLE "equipment_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipment_profiles_select_own" ON "equipment_profiles"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "equipment_profiles_insert_own" ON "equipment_profiles"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "equipment_profiles_update_own" ON "equipment_profiles"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "equipment_profiles_delete_own" ON "equipment_profiles"
  FOR DELETE USING (auth.uid() = user_id);

-- recipes
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_select_own" ON "recipes"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recipes_insert_own" ON "recipes"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_update_own" ON "recipes"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_delete_own" ON "recipes"
  FOR DELETE USING (auth.uid() = user_id);

-- recipe_fermentables (accès via la recette parente)
ALTER TABLE "recipe_fermentables" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_fermentables_all_own" ON "recipe_fermentables"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );

-- recipe_hops (accès via la recette parente)
ALTER TABLE "recipe_hops" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_hops_all_own" ON "recipe_hops"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );

-- recipe_yeasts (accès via la recette parente)
ALTER TABLE "recipe_yeasts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_yeasts_all_own" ON "recipe_yeasts"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );

-- batches
ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches_select_own" ON "batches"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "batches_insert_own" ON "batches"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "batches_update_own" ON "batches"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "batches_delete_own" ON "batches"
  FOR DELETE USING (auth.uid() = user_id);

-- batch_steps (accès via le batch parent)
ALTER TABLE "batch_steps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_steps_all_own" ON "batch_steps"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "batches" b WHERE b.id = batch_id AND b.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "batches" b WHERE b.id = batch_id AND b.user_id = auth.uid())
  );

-- fermentation_readings (accès via le batch parent ; les Edge Functions
-- d'ingestion capteur V1.1 utilisent la clé service_role et contournent RLS)
ALTER TABLE "fermentation_readings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fermentation_readings_all_own" ON "fermentation_readings"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "batches" b WHERE b.id = batch_id AND b.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "batches" b WHERE b.id = batch_id AND b.user_id = auth.uid())
  );

-- devices
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devices_select_own" ON "devices"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "devices_insert_own" ON "devices"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "devices_update_own" ON "devices"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "devices_delete_own" ON "devices"
  FOR DELETE USING (auth.uid() = user_id);

-- bjcp_styles : table de référence, lecture seule pour tout le monde
ALTER TABLE "bjcp_styles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bjcp_styles_select_all" ON "bjcp_styles"
  FOR SELECT USING (true);
