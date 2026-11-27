CREATE TABLE "broadcast_progress" (
	"user_id" text NOT NULL,
	"broadcast_id" varchar(36) NOT NULL,
	"kind" varchar(16) DEFAULT 'replay' NOT NULL,
	"position_seconds" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "broadcast_progress_user_id_broadcast_id_pk" PRIMARY KEY("user_id","broadcast_id")
);
--> statement-breakpoint
ALTER TABLE "broadcast_progress" ADD CONSTRAINT "broadcast_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_progress" ADD CONSTRAINT "broadcast_progress_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broadcast_progress_broadcast_idx" ON "broadcast_progress" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "broadcast_progress_updated_idx" ON "broadcast_progress" USING btree ("updated_at");