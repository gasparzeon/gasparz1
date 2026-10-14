ALTER TYPE "public"."user_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requested_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Contas existentes: o pedido é a criação da conta e a decisão é a aprovação.
UPDATE "users" SET "requested_at" = "created_at", "reviewed_at" = "approved_at", "reviewed_by" = "approved_by";
