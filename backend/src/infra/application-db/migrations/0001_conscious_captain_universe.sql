CREATE TYPE "public"."initiative_status" AS ENUM('not_started', 'in_progress', 'blocked', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."intervention_status" AS ENUM('planned', 'active', 'measuring', 'concluded');--> statement-breakpoint
CREATE TYPE "public"."kr_direction" AS ENUM('increase', 'decrease');--> statement-breakpoint
CREATE TYPE "public"."kr_metric_type" AS ENUM('number', 'percent', 'currency', 'boolean');--> statement-breakpoint
CREATE TYPE "public"."objective_scope" AS ENUM('org', 'department', 'team');--> statement-breakpoint
CREATE TYPE "public"."objective_status" AS ENUM('draft', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "alignment_link" (
	"from_type" varchar(50) NOT NULL,
	"from_id" integer NOT NULL,
	"to_type" varchar(50) NOT NULL,
	"to_id" integer NOT NULL,
	"weight" numeric(6, 2) DEFAULT '1.00',
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "initiative" (
	"title" varchar(255) NOT NULL,
	"description" text,
	"owner_person_id" integer NOT NULL,
	"priority" varchar(50) NOT NULL,
	"due_date" timestamp with time zone,
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
CREATE TABLE "initiative_key_result" (
	"initiative_id" integer NOT NULL,
	"key_result_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "intervention" (
	"title" varchar(255) NOT NULL,
	"description" text,
	"decided_by_person_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"scope" varchar(100) NOT NULL,
	"hypothesis" text,
	"measurement_window_days" integer DEFAULT 14 NOT NULL,
	"status" "intervention_status" DEFAULT 'planned' NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "intervention_key_result" (
	"intervention_id" integer NOT NULL,
	"key_result_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "key_result" (
	"objective_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"metric_type" "kr_metric_type" NOT NULL,
	"unit" varchar(100),
	"start_value" numeric(20, 4),
	"target_value" numeric(20, 4),
	"current_value" numeric(20, 4),
	"direction" "kr_direction" NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "objective" (
	"title" varchar(255) NOT NULL,
	"description" text,
	"owner_person_id" integer NOT NULL,
	"scope" "objective_scope" NOT NULL,
	"scope_ref_id" integer,
	"period" varchar(50) NOT NULL,
	"status" "objective_status" DEFAULT 'draft' NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE INDEX "alignment_link_from_index" ON "alignment_link" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "alignment_link_to_index" ON "alignment_link" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE INDEX "initiative_owner_index" ON "initiative" USING btree ("owner_person_id");--> statement-breakpoint
CREATE INDEX "initiative_status_index" ON "initiative" USING btree ("status");--> statement-breakpoint
CREATE INDEX "initiative_key_result_initiative_index" ON "initiative_key_result" USING btree ("initiative_id");--> statement-breakpoint
CREATE INDEX "initiative_key_result_key_result_index" ON "initiative_key_result" USING btree ("key_result_id");--> statement-breakpoint
CREATE INDEX "intervention_decided_by_index" ON "intervention" USING btree ("decided_by_person_id");--> statement-breakpoint
CREATE INDEX "intervention_key_result_intervention_index" ON "intervention_key_result" USING btree ("intervention_id");--> statement-breakpoint
CREATE INDEX "intervention_key_result_key_result_index" ON "intervention_key_result" USING btree ("key_result_id");--> statement-breakpoint
CREATE INDEX "key_result_objective_index" ON "key_result" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "objective_owner_index" ON "objective" USING btree ("owner_person_id");