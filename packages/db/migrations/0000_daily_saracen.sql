CREATE TABLE "batches" (
	"key" text PRIMARY KEY NOT NULL,
	"items" jsonb NOT NULL,
	"job_ids" jsonb,
	"state" text DEFAULT 'pending' NOT NULL,
	"lease_until" timestamp with time zone,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beliefs" (
	"key" text PRIMARY KEY NOT NULL,
	"head" jsonb NOT NULL,
	"status" text NOT NULL,
	"public_approved" boolean DEFAULT false NOT NULL,
	"last_checked" timestamp with time zone,
	"next_check" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget" (
	"id" text PRIMARY KEY NOT NULL,
	"reserved_credits" integer DEFAULT 0 NOT NULL,
	"limit_credits" integer DEFAULT 100000 NOT NULL,
	"estimated_cost" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_usage" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"method" text NOT NULL,
	"status" text NOT NULL,
	"provenance" text NOT NULL,
	"credits" integer,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"belief_key" text NOT NULL,
	"seq" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"blob_id" text
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_key" text NOT NULL,
	"item_id" text NOT NULL,
	"state" text NOT NULL,
	"blob_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"namespace" text NOT NULL,
	"text" text NOT NULL,
	"batch_key" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pacing" (
	"id" text PRIMARY KEY NOT NULL,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"model" jsonb NOT NULL,
	"cause_event_id" text NOT NULL,
	"provenance" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"blob_id" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "events_belief_seq" ON "events" USING btree ("belief_key","seq");