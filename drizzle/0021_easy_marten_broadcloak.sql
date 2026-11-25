CREATE TABLE "site_pages" (
	"key" varchar(32) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_pages_key_check" CHECK ("site_pages"."key" in ('about', 'support', 'community'))
);
--> statement-breakpoint
CREATE TABLE "translators" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(120),
	"description" text,
	"url" varchar(1024),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
