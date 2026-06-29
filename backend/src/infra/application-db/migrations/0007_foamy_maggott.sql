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
CREATE INDEX "attachment_created_by_index" ON "attachment" USING btree ("created_by_person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "initiative_key_result_unique" ON "initiative_key_result" USING btree ("initiative_id","key_result_id") WHERE "initiative_key_result"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "intervention_key_result_unique" ON "intervention_key_result" USING btree ("intervention_id","key_result_id") WHERE "intervention_key_result"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "task_assignee_unique" ON "task_assignee" USING btree ("task_id","person_id") WHERE "task_assignee"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "task_label_unique" ON "task_label" USING btree ("task_id","label_id") WHERE "task_label"."is_deleted" = false;