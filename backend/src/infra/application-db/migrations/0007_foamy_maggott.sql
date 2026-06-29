CREATE TYPE "public"."file_purpose" AS ENUM('general', 'public');--> statement-breakpoint
CREATE TABLE "attachment" (
	"token" varchar(64) NOT NULL,
	"bucket" varchar(128) NOT NULL,
	"path" varchar(1024) NOT NULL,
	"hash" varchar(128) NOT NULL,
	"size" bigint NOT NULL,
	"mimetype" varchar(255) NOT NULL,
	"width" integer,
	"height" integer,
	"thumbnail_path" text,
	"purpose" "file_purpose" DEFAULT 'general' NOT NULL,
	"created_by_person_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_token_index" ON "attachment" USING btree ("token");--> statement-breakpoint
CREATE INDEX "attachment_hash_index" ON "attachment" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "attachment_created_by_index" ON "attachment" USING btree ("created_by_person_id");