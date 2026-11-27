CREATE TABLE "audio_versions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"label" varchar(120) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chapter_audio_versions" (
	"id" varchar(200) PRIMARY KEY NOT NULL,
	"chapter_id" varchar(128) NOT NULL,
	"version_id" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"audio_url" varchar(1024) NOT NULL,
	"duration_seconds" integer NOT NULL,
	"chapter_start" integer NOT NULL,
	"chapter_end" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chapter_audio_versions" ADD CONSTRAINT "chapter_audio_versions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chapter_audio_versions" ADD CONSTRAINT "chapter_audio_versions_version_id_audio_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."audio_versions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chapter_audio_versions_chapter_id_idx" ON "chapter_audio_versions" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "chapter_audio_versions_version_id_idx" ON "chapter_audio_versions" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_audio_versions_chapter_version_unique" ON "chapter_audio_versions" USING btree ("chapter_id","version_id");