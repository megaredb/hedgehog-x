CREATE TABLE "subscription_price_changes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"old_price" integer NOT NULL,
	"new_price" integer NOT NULL,
	"scope" varchar(16) NOT NULL,
	"admin_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_price_notices" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"price_change_id" varchar(36) NOT NULL,
	"old_price" integer NOT NULL,
	"new_price" integer NOT NULL,
	"scope" varchar(16) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"dismissed_at" timestamp,
	"dismissed_reason" varchar(16)
);
--> statement-breakpoint
CREATE TABLE "subscription_settings" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"price_per_day" integer DEFAULT 7 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "price_per_day" integer;--> statement-breakpoint
UPDATE "subscription_events" SET "price_per_day" = 7 WHERE "type" = 'grant' AND "amount_rub" IS NOT NULL AND "price_per_day" IS NULL;--> statement-breakpoint
ALTER TABLE "subscription_price_changes" ADD CONSTRAINT "subscription_price_changes_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_notices" ADD CONSTRAINT "subscription_price_notices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_price_notices" ADD CONSTRAINT "subscription_price_notices_price_change_id_subscription_price_changes_id_fk" FOREIGN KEY ("price_change_id") REFERENCES "public"."subscription_price_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_settings" ADD CONSTRAINT "subscription_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_price_notices_user_idx" ON "subscription_price_notices" USING btree ("user_id","dismissed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_price_notices_user_change_idx" ON "subscription_price_notices" USING btree ("user_id","price_change_id");
