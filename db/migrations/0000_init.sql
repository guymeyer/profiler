CREATE TYPE "public"."customer_source" AS ENUM('manual', 'research');--> statement-breakpoint
CREATE TYPE "public"."influence_level" AS ENUM('executive', 'senior', 'lead', 'ic');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."okr_level" AS ENUM('company', 'bu');--> statement-breakpoint
CREATE TYPE "public"."okr_status" AS ENUM('on-track', 'at-risk', 'off-track', 'achieved');--> statement-breakpoint
CREATE TYPE "public"."person_source" AS ENUM('seed', 'manual', 'research');--> statement-breakpoint
CREATE TABLE "business_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"leader_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"size" text,
	"region" text,
	"summary" text DEFAULT '' NOT NULL,
	"known_stakeholders" text[] DEFAULT '{}' NOT NULL,
	"buying_triggers" text[] DEFAULT '{}' NOT NULL,
	"evaluation_criteria" text[] DEFAULT '{}' NOT NULL,
	"red_flags" text[] DEFAULT '{}' NOT NULL,
	"competitive_context" text[] DEFAULT '{}' NOT NULL,
	"notes" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"source" "customer_source" DEFAULT 'manual' NOT NULL,
	"is_self_company" boolean DEFAULT false NOT NULL,
	"researched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"requester_email" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_workspace_id_pk" PRIMARY KEY("user_id","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "okrs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"objective" text NOT NULL,
	"key_results" text[] DEFAULT '{}' NOT NULL,
	"level" "okr_level" NOT NULL,
	"business_unit_id" uuid,
	"owner_person_ids" uuid[] DEFAULT '{}' NOT NULL,
	"attached_person_ids" uuid[] DEFAULT '{}' NOT NULL,
	"timeframe" text NOT NULL,
	"status" "okr_status",
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"team" text NOT NULL,
	"influence" "influence_level" NOT NULL,
	"comm_style" text[] DEFAULT '{}' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"review_preferences" text[] DEFAULT '{}' NOT NULL,
	"visual_preferences" text[] DEFAULT '{}' NOT NULL,
	"decision_triggers" text[] DEFAULT '{}' NOT NULL,
	"objections" text[] DEFAULT '{}' NOT NULL,
	"dos" text[] DEFAULT '{}' NOT NULL,
	"donts" text[] DEFAULT '{}' NOT NULL,
	"example_guidance" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"customer_id" uuid,
	"source" "person_source" DEFAULT 'manual' NOT NULL,
	"researched_at" timestamp with time zone,
	"rank_within_level" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"title" text NOT NULL,
	"fit_score" integer NOT NULL,
	"person_ids" uuid[] DEFAULT '{}' NOT NULL,
	"customer_id" uuid,
	"generated_by" text NOT NULL,
	"feedback" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'Internal' NOT NULL,
	"conducted_at" timestamp with time zone,
	"participants" text[] DEFAULT '{}' NOT NULL,
	"methodology" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"linked_person_ids" uuid[] DEFAULT '{}' NOT NULL,
	"linked_customer_ids" uuid[] DEFAULT '{}' NOT NULL,
	"linked_objective_ids" text[] DEFAULT '{}' NOT NULL,
	"uploaded_from_filename" text,
	"uploaded_from_kind" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"person_ids" uuid[] DEFAULT '{}' NOT NULL,
	"objective_ids" text[] DEFAULT '{}' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"primary_domain" text,
	"self_company_id" uuid,
	"research_in_progress" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "okrs" ADD CONSTRAINT "okrs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_artifacts" ADD CONSTRAINT "research_artifacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_audiences" ADD CONSTRAINT "saved_audiences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_units_workspace_idx" ON "business_units" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_workspace_slug_idx" ON "customers" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "customers_workspace_self_idx" ON "customers" USING btree ("workspace_id","is_self_company");--> statement-breakpoint
CREATE INDEX "join_requests_workspace_idx" ON "join_requests" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "join_requests_user_status_idx" ON "join_requests" USING btree ("requester_user_id","status");--> statement-breakpoint
CREATE INDEX "memberships_workspace_idx" ON "memberships" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "okrs_workspace_idx" ON "okrs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "okrs_workspace_bu_idx" ON "okrs" USING btree ("workspace_id","business_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_workspace_slug_idx" ON "people" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "people_workspace_customer_idx" ON "people" USING btree ("workspace_id","customer_id");--> statement-breakpoint
CREATE INDEX "results_workspace_idx" ON "recommendation_results" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "results_workspace_created_idx" ON "recommendation_results" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "research_workspace_idx" ON "research_artifacts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "research_workspace_created_idx" ON "research_artifacts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_audiences_workspace_idx" ON "saved_audiences" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" USING btree ("slug");