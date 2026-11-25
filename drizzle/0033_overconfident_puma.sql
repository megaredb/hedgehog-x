CREATE TABLE "chapter_illustrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"chapter_id" varchar(128) NOT NULL,
	"illustration_id" varchar(128) NOT NULL,
	"show_at_seconds" double precision DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapter_illustrations" ADD CONSTRAINT "chapter_illustrations_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chapter_illustrations" ADD CONSTRAINT "chapter_illustrations_illustration_id_illustrations_id_fk" FOREIGN KEY ("illustration_id") REFERENCES "public"."illustrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chapter_illustrations_chapter_idx" ON "chapter_illustrations" USING btree ("chapter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_illustrations_chapter_illustration_unique" ON "chapter_illustrations" USING btree ("chapter_id","illustration_id");--> statement-breakpoint
INSERT INTO "chapter_illustrations" ("id", "chapter_id", "illustration_id", "show_at_seconds", "sort_order")
SELECT substr(gen_random_uuid()::text, 1, 36), t.chapter_id, t.illustration_id, t.show_at_seconds, t.sort_order
FROM (
	SELECT DISTINCT ON (b.chapter_id, bi.illustration_id)
		b.chapter_id, bi.illustration_id, bi.show_at_seconds, bi.sort_order
	FROM broadcast_illustrations bi
	INNER JOIN broadcasts b ON b.id = bi.broadcast_id
	ORDER BY b.chapter_id, bi.illustration_id, b.started_at DESC NULLS LAST, bi.show_at_seconds ASC
) t
ON CONFLICT DO NOTHING;
