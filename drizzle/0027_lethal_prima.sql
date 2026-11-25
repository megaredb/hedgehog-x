CREATE TABLE "broadcast_illustrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(36) NOT NULL,
	"illustration_id" varchar(128) NOT NULL,
	"show_at_seconds" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_listeners" (
	"broadcast_id" varchar(36) NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	CONSTRAINT "broadcast_listeners_broadcast_id_user_id_pk" PRIMARY KEY("broadcast_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "broadcast_messages" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(36) NOT NULL,
	"user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_views" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(36) NOT NULL,
	"user_id" text,
	"kind" varchar(16) DEFAULT 'live' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"chapter_id" varchar(128) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"cover_url" varchar(1024),
	"scheduled_start_at" timestamp NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"save_recording" boolean DEFAULT true NOT NULL,
	"publish_after_end" boolean DEFAULT true NOT NULL,
	"chat_enabled" boolean DEFAULT true NOT NULL,
	"published_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "chapters" SET "published" = true;--> statement-breakpoint
ALTER TABLE "broadcast_illustrations" ADD CONSTRAINT "broadcast_illustrations_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_illustrations" ADD CONSTRAINT "broadcast_illustrations_illustration_id_illustrations_id_fk" FOREIGN KEY ("illustration_id") REFERENCES "public"."illustrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_listeners" ADD CONSTRAINT "broadcast_listeners_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_listeners" ADD CONSTRAINT "broadcast_listeners_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD CONSTRAINT "broadcast_views_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD CONSTRAINT "broadcast_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "broadcast_illustration_unique" ON "broadcast_illustrations" USING btree ("broadcast_id","illustration_id");--> statement-breakpoint
CREATE INDEX "broadcast_listeners_seen_idx" ON "broadcast_listeners" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "broadcast_messages_broadcast_time_idx" ON "broadcast_messages" USING btree ("broadcast_id","created_at");--> statement-breakpoint
CREATE INDEX "broadcast_views_broadcast_idx" ON "broadcast_views" USING btree ("broadcast_id","started_at");--> statement-breakpoint
CREATE INDEX "broadcasts_start_idx" ON "broadcasts" USING btree ("scheduled_start_at");--> statement-breakpoint
CREATE INDEX "broadcasts_published_idx" ON "broadcasts" USING btree ("published_at");