ALTER TABLE "books" ADD COLUMN "cover_width" integer;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "cover_height" integer;--> statement-breakpoint
ALTER TABLE "volumes" ADD COLUMN "cover_width" integer;--> statement-breakpoint
ALTER TABLE "volumes" ADD COLUMN "cover_height" integer;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_status_check" CHECK ("books"."status" is null or "books"."status" in ('ongoing','completed','hiatus','dropped'));--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_theme_color_check" CHECK ("books"."theme_color" is null or "books"."theme_color" ~ '^[0-9a-fA-F]{6}$');--> statement-breakpoint
ALTER TABLE "volumes" ADD CONSTRAINT "volumes_status_check" CHECK ("volumes"."status" is null or "volumes"."status" in ('ongoing','completed','hiatus','dropped'));