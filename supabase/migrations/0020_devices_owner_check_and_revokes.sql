-- Un device ne peut être rattaché (active_batch_id) qu'à un brassin de son propriétaire.
-- Sans ce contrôle, un utilisateur pouvait diriger les lectures de son iSpindel vers le brassin d'un autre.
DROP POLICY "devices_insert_own" ON "devices";
CREATE POLICY "devices_insert_own" ON "devices"
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (active_batch_id IS NULL OR EXISTS (
      SELECT 1 FROM "batches" b WHERE b.id = active_batch_id AND b.user_id = auth.uid()
    ))
  );

DROP POLICY "devices_update_own" ON "devices";
CREATE POLICY "devices_update_own" ON "devices"
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (active_batch_id IS NULL OR EXISTS (
      SELECT 1 FROM "batches" b WHERE b.id = active_batch_id AND b.user_id = auth.uid()
    ))
  );

-- Privilèges inutiles : TRUNCATE ignore la RLS. Ils viennent des droits par défaut de Supabase, pas de 0003.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
