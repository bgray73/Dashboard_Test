CREATE TYPE "public"."collector_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."reachability_job_status" AS ENUM('queued', 'leased', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_roles" AS ENUM('admin', 'operator', 'viewer');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostname" text NOT NULL,
	"management_ip" text NOT NULL,
	"device_type" text NOT NULL,
	"vendor" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"operating_system" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"serial_number" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"monitoring_enabled" boolean DEFAULT false NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_starts_at" timestamp with time zone,
	"maintenance_ends_at" timestamp with time zone,
	"monitoring_interval_seconds" integer DEFAULT 60 NOT NULL,
	"last_status" text DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_latency_ms" integer,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vendor" text NOT NULL,
	"configuration_type" text NOT NULL,
	"associated_device_id" integer,
	"generated_configuration" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_name" text DEFAULT 'LabOps' NOT NULL,
	"default_theme" text DEFAULT 'dark' NOT NULL,
	"default_config_vendor" text DEFAULT 'Cisco IOS / IOS-XE' NOT NULL,
	"ping_timeout_seconds" integer DEFAULT 3 NOT NULL,
	"monitoring_retention_days" integer DEFAULT 30 NOT NULL,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_url" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer,
	"error_message" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'automated' NOT NULL,
	"idempotency_identifier" text
);
--> statement-breakpoint
CREATE TABLE "monitoring_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_failure_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text,
	"operator_note" text,
	"peak_failures" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer,
	"error_message" text,
	"resolution_reason" text,
	"idempotency_identifier" text,
	CONSTRAINT "monitoring_incidents_peak_failures_nonnegative" CHECK ("monitoring_incidents"."peak_failures" >= 0),
	CONSTRAINT "monitoring_incidents_duration_nonnegative" CHECK ("monitoring_incidents"."duration_seconds" is null or "monitoring_incidents"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer,
	"event_type" text NOT NULL,
	"destination" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"error_message" text,
	"payload" jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "maintenance_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"maintenance_starts_at" timestamp with time zone,
	"maintenance_ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "incident_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"actor" text,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hostname" text,
	"token_hash" text NOT NULL,
	"status" "collector_status" DEFAULT 'active' NOT NULL,
	"capabilities" jsonb DEFAULT '["icmp"]'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collectors_name_unique" UNIQUE("name"),
	CONSTRAINT "collectors_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "reachability_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"collector_id" integer,
	"device_id" integer NOT NULL,
	"target" text NOT NULL,
	"status" "reachability_job_status" DEFAULT 'queued' NOT NULL,
	"timeout_ms" integer DEFAULT 5000 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"lease_id" text,
	"lease_expires_at" timestamp with time zone,
	"result_status" text,
	"latency_ms" integer,
	"error_code" text,
	"error_message" text,
	"result_digest" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leased_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reachability_jobs_timeout_positive" CHECK ("reachability_jobs"."timeout_ms" > 0),
	CONSTRAINT "reachability_jobs_timeout_bounded" CHECK ("reachability_jobs"."timeout_ms" <= 30000),
	CONSTRAINT "reachability_jobs_attempt_count_nonnegative" CHECK ("reachability_jobs"."attempt_count" >= 0),
	CONSTRAINT "reachability_jobs_latency_nonnegative" CHECK ("reachability_jobs"."latency_ms" is null or "reachability_jobs"."latency_ms" >= 0),
	CONSTRAINT "reachability_jobs_latency_bounded" CHECK ("reachability_jobs"."latency_ms" is null or "reachability_jobs"."latency_ms" <= 3600000),
	CONSTRAINT "reachability_jobs_result_status_valid" CHECK ("reachability_jobs"."result_status" is null or "reachability_jobs"."result_status" in ('online', 'offline', 'unknown')),
	CONSTRAINT "reachability_jobs_error_code_bounded" CHECK ("reachability_jobs"."error_code" is null or length("reachability_jobs"."error_code") <= 64),
	CONSTRAINT "reachability_jobs_error_message_bounded" CHECK ("reachability_jobs"."error_message" is null or length("reachability_jobs"."error_message") <= 512),
	CONSTRAINT "reachability_jobs_lease_consistent" CHECK ("reachability_jobs"."status" <> 'leased' or ("reachability_jobs"."collector_id" is not null and "reachability_jobs"."lease_id" is not null and "reachability_jobs"."lease_expires_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"identity_issuer" text NOT NULL,
	"identity_subject" text NOT NULL,
	"email" text,
	"display_name" text,
	"email_verified" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_identity_issuer_subject_unique" UNIQUE("identity_issuer","identity_subject")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked" text DEFAULT 'false' NOT NULL,
	"user_agent" text,
	"ip_address" text,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "auth_sessions_idle_before_absolute_check" CHECK ("auth_sessions"."expires_at" > "auth_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "oidc_auth_flows" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"nonce" text NOT NULL,
	"pkce_verifier" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "user_roles" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"granted_by" integer,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "monitoring_history" ADD CONSTRAINT "monitoring_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_incidents" ADD CONSTRAINT "monitoring_incidents_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_incident_id_monitoring_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."monitoring_incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_activity" ADD CONSTRAINT "incident_activity_incident_id_monitoring_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."monitoring_incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reachability_jobs" ADD CONSTRAINT "reachability_jobs_collector_id_collectors_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reachability_jobs" ADD CONSTRAINT "reachability_jobs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monitoring_history_device_checked_idx" ON "monitoring_history" USING btree ("device_id","checked_at");--> statement-breakpoint
CREATE INDEX "monitoring_history_checked_idx" ON "monitoring_history" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "monitoring_history_idempotency_idx" ON "monitoring_history" USING btree ("idempotency_identifier");--> statement-breakpoint
CREATE INDEX "monitoring_incidents_device_started_idx" ON "monitoring_incidents" USING btree ("device_id","started_at");--> statement-breakpoint
CREATE INDEX "monitoring_incidents_status_started_idx" ON "monitoring_incidents" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_incident_per_device_idx" ON "monitoring_incidents" USING btree ("device_id") WHERE "monitoring_incidents"."status" = 'open';--> statement-breakpoint
CREATE INDEX "notification_deliveries_incident_attempted_idx" ON "notification_deliveries" USING btree ("incident_id","attempted_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_attempted_idx" ON "notification_deliveries" USING btree ("status","attempted_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_next_attempt_idx" ON "notification_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "maintenance_history_device_occurred_idx" ON "maintenance_history" USING btree ("device_id","occurred_at");--> statement-breakpoint
CREATE INDEX "maintenance_history_occurred_idx" ON "maintenance_history" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "incident_activity_incident_occurred_idx" ON "incident_activity" USING btree ("incident_id","occurred_at");--> statement-breakpoint
CREATE INDEX "collectors_status_last_seen_idx" ON "collectors" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "reachability_jobs_status_queued_idx" ON "reachability_jobs" USING btree ("status","queued_at");--> statement-breakpoint
CREATE INDEX "reachability_jobs_lease_expires_idx" ON "reachability_jobs" USING btree ("lease_expires_at");--> statement-breakpoint
CREATE INDEX "reachability_jobs_collector_status_idx" ON "reachability_jobs" USING btree ("collector_id","status");--> statement-breakpoint
CREATE INDEX "reachability_jobs_device_queued_idx" ON "reachability_jobs" USING btree ("device_id","queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reachability_jobs_one_active_per_device_idx" ON "reachability_jobs" USING btree ("device_id") WHERE "reachability_jobs"."status" in ('queued', 'leased');--> statement-breakpoint
CREATE INDEX "auth_sessions_expiry_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_last_seen_idx" ON "auth_sessions" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oidc_auth_flows_expires_idx" ON "oidc_auth_flows" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_role_unique" ON "roles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_membership_user_role_unique" ON "user_role_memberships" USING btree ("user_id","role_id");