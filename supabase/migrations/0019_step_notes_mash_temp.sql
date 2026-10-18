ALTER TABLE "batch_steps" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "mash_temp_reached_c" numeric(4, 1);