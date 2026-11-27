CREATE TABLE "donation_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"donor_key" uuid NOT NULL,
	"user_id" text,
	"amount_rub" integer NOT NULL,
	"price_per_day" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"source" varchar(16) NOT NULL,
	"note" varchar(500),
	"idempotency_key" varchar(128) NOT NULL,
	CONSTRAINT "donation_ledger_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "donation_ledger_amount_check" CHECK ("donation_ledger"."amount_rub" > 0)
);
--> statement-breakpoint
ALTER TABLE "donation_ledger" ADD CONSTRAINT "donation_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donation_ledger_donor_key_idx" ON "donation_ledger" USING btree ("donor_key");--> statement-breakpoint
CREATE INDEX "donation_ledger_created_at_idx" ON "donation_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "donation_ledger_user_id_idx" ON "donation_ledger" USING btree ("user_id");