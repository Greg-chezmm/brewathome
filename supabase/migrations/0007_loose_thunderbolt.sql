ALTER TABLE "batch_steps" ADD COLUMN "checked_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "mash_temp_c" numeric(4, 1) DEFAULT '67' NOT NULL;