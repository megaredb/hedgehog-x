CREATE TABLE "subscription_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(32) NOT NULL,
	"source" varchar(16) NOT NULL,
	"days" integer,
	"amount_rub" integer,
	"before_expires_at" timestamp,
	"after_expires_at" timestamp,
	"before_lifetime" boolean,
	"after_lifetime" boolean,
	"provider" varchar(16),
	"external_id" varchar(64),
	"admin_user_id" text,
	"note" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_sources" (
	"user_id" text NOT NULL,
	"provider" varchar(16) NOT NULL,
	"external_id" varchar(64) NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp,
	"last_error" varchar(500),
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_sources_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"manual_expires_at" timestamp,
	"is_lifetime" boolean DEFAULT false NOT NULL,
	"blocked_at" timestamp,
	"blocked_reason" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_sources" ADD CONSTRAINT "subscription_sources_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_events_user_created_idx" ON "subscription_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_events_type_idx" ON "subscription_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "subscription_sources_provider_external_idx" ON "subscription_sources" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "subscriptions_manual_expires_idx" ON "subscriptions" USING btree ("manual_expires_at");--> statement-breakpoint
CREATE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");