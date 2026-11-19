CREATE TABLE "daily_listening_stats" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"date" varchar(10) NOT NULL,
	"user_id" text,
	"book_id" varchar(128),
	"chapter_id" varchar(128),
	"total_seconds" integer DEFAULT 0 NOT NULL,
	"sessions_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listening_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text,
	"book_id" varchar(128),
	"volume_id" varchar(128),
	"chapter_id" varchar(128) NOT NULL,
	"listened_seconds" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "cover_url" SET DATA TYPE varchar(1024);--> statement-breakpoint
ALTER TABLE "chapters" ALTER COLUMN "audio_url" SET DATA TYPE varchar(1024);--> statement-breakpoint
ALTER TABLE "chapters" ALTER COLUMN "telegram_post_url" SET DATA TYPE varchar(1024);--> statement-breakpoint
ALTER TABLE "illustrations" ALTER COLUMN "image_url" SET DATA TYPE varchar(1024);--> statement-breakpoint
ALTER TABLE "volumes" ALTER COLUMN "cover_url" SET DATA TYPE varchar(1024);--> statement-breakpoint
ALTER TABLE "volumes" ADD COLUMN "status" varchar(50) DEFAULT 'ongoing';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_listening_stats" ADD CONSTRAINT "daily_listening_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_listening_stats" ADD CONSTRAINT "daily_listening_stats_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_listening_stats" ADD CONSTRAINT "daily_listening_stats_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_sessions" ADD CONSTRAINT "listening_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_sessions" ADD CONSTRAINT "listening_sessions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_sessions" ADD CONSTRAINT "listening_sessions_volume_id_volumes_id_fk" FOREIGN KEY ("volume_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_sessions" ADD CONSTRAINT "listening_sessions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "daily_stats_date_idx" ON "daily_listening_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "daily_stats_book_idx" ON "daily_listening_stats" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "daily_stats_user_idx" ON "daily_listening_stats" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_stats_unique_entry" ON "daily_listening_stats" USING btree ("date","book_id","chapter_id","user_id");--> statement-breakpoint
CREATE INDEX "listening_sessions_user_idx" ON "listening_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listening_sessions_chapter_idx" ON "listening_sessions" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "listening_sessions_started_at_idx" ON "listening_sessions" USING btree ("started_at");