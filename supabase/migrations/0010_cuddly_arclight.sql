CREATE TABLE "brewfather_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"brewfather_user_id" text NOT NULL,
	"api_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brewfather_accounts" ADD CONSTRAINT "brewfather_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS : chacun ne lit et ne modifie que son propre accès Brewfather.
ALTER TABLE "brewfather_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "brewfather_accounts_select_own" ON "brewfather_accounts"
  FOR SELECT USING (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "brewfather_accounts_insert_own" ON "brewfather_accounts"
  FOR INSERT WITH CHECK (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "brewfather_accounts_update_own" ON "brewfather_accounts"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "brewfather_accounts_delete_own" ON "brewfather_accounts"
  FOR DELETE USING (auth.uid() = user_id);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "brewfather_accounts" TO authenticated;
