CREATE TYPE "public"."task_priority" AS ENUM('urgent', 'high', 'medium', 'low', 'none');--> statement-breakpoint
ALTER TYPE "public"."subject_type" ADD VALUE IF NOT EXISTS 'task';--> statement-breakpoint
CREATE TABLE "label" (
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(32),
	"parent_id" integer,
	"sort_order" double precision DEFAULT 65535 NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "task" (
	"initiative_id" integer NOT NULL,
	"parent_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'none' NOT NULL,
	"start_date" timestamp with time zone,
	"target_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"sort_order" double precision DEFAULT 65535 NOT NULL,
	"sequence_id" integer,
	"created_by_person_id" integer NOT NULL,
	"status" "initiative_status" DEFAULT 'not_started' NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "task_assignee" (
	"task_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "task_label" (
	"task_id" integer NOT NULL,
	"label_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "task_state" (
	"task_id" integer NOT NULL,
	"status" "initiative_status" DEFAULT 'not_started' NOT NULL,
	"total_time_logged_minutes" integer DEFAULT 0 NOT NULL,
	"blocked_since" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE INDEX "label_name_index" ON "label" USING btree ("name");--> statement-breakpoint
CREATE INDEX "label_parent_index" ON "label" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "task_initiative_index" ON "task" USING btree ("initiative_id");--> statement-breakpoint
CREATE INDEX "task_parent_index" ON "task" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "task_status_index" ON "task" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "task_sequence_index" ON "task" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "task_assignee_task_index" ON "task_assignee" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_assignee_person_index" ON "task_assignee" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "task_label_task_index" ON "task_label" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_label_label_index" ON "task_label" USING btree ("label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_state_task_id_index" ON "task_state" USING btree ("task_id");--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "task_sequence_seq";--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "sequence_id" SET DEFAULT nextval('task_sequence_seq');