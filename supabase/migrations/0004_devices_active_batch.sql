    -- Associe un device (iSpindel/Tilt) à un brassin actif : l'Edge Function
    -- d'ingestion s'en sert pour savoir dans quel batch insérer les lectures reçues.
    ALTER TABLE "devices" ADD COLUMN "active_batch_id" uuid REFERENCES "batches"("id") ON DELETE SET NULL;
