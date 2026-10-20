-- Un brassin ne peut référencer (recipe_id) qu'une recette de son propriétaire.
DROP POLICY "batches_insert_own" ON "batches";
CREATE POLICY "batches_insert_own" ON "batches"
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (recipe_id IS NULL OR EXISTS (
      SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid()
    ))
  );

DROP POLICY "batches_update_own" ON "batches";
CREATE POLICY "batches_update_own" ON "batches"
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (recipe_id IS NULL OR EXISTS (
      SELECT 1 FROM "recipes" r WHERE r.id = recipe_id AND r.user_id = auth.uid()
    ))
  );
