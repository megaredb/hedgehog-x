CREATE TABLE "illustrations" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"volume_id" varchar(128) NOT NULL,
	"image_url" varchar(512) NOT NULL,
	"blurhash" varchar(100),
	"caption" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "illustrations" ADD CONSTRAINT "illustrations_volume_id_volumes_id_fk" FOREIGN KEY ("volume_id") REFERENCES "public"."volumes"("id") ON DELETE cascade ON UPDATE cascade;