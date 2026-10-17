ALTER TABLE "batches" ADD COLUMN "brewfather_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "batches_user_brewfather_id_idx" ON "batches" USING btree ("user_id","brewfather_id");