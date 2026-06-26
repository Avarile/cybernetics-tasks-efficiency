CREATE TYPE "public"."activity_event_type" AS ENUM('created', 'started', 'paused', 'resumed', 'blocked', 'unblocked', 'cancelled', 'completed', 'time_logged', 'reason_recorded', 'outcome_recorded', 'note_added', 'key_result_measured');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('human', 'agent', 'integration');--> statement-breakpoint
CREATE TYPE "public"."subject_type" AS ENUM('initiative', 'key_result', 'objective');--> statement-breakpoint
CREATE TABLE "activity_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now(),
	"actor_person_id" integer NOT NULL,
	"subject_type" "subject_type" NOT NULL,
	"subject_id" integer NOT NULL,
	"type" "activity_event_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"source" "event_source" DEFAULT 'human' NOT NULL,
	"confidence" numeric(5, 4),
	"raw_input_id" integer,
	"correlation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "initiative_state" (
	"initiative_id" integer NOT NULL,
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
CREATE TABLE "key_result_measurement" (
	"key_result_id" integer NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"source_event_id" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "raw_input" (
	"person_id" integer NOT NULL,
	"channel" varchar NOT NULL,
	"text" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "reason_taxonomy" (
	"label" varchar NOT NULL,
	"category" varchar NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE INDEX "activity_event_subject_index" ON "activity_event" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "activity_event_occurred_brin" ON "activity_event" USING brin ("occurred_at");--> statement-breakpoint
CREATE INDEX "activity_event_payload_gin" ON "activity_event" USING gin ("payload");--> statement-breakpoint
CREATE INDEX "activity_event_type_index" ON "activity_event" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "initiative_state_initiative_id_index" ON "initiative_state" USING btree ("initiative_id");--> statement-breakpoint
CREATE INDEX "key_result_measurement_key_result_index" ON "key_result_measurement" USING btree ("key_result_id");