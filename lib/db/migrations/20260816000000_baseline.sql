-- LabOps Database Migration
-- Generated from Drizzle ORM schema

-- Enums
CREATE TYPE "public"."collector_status" AS ENUM('active', 'revoked');
CREATE TYPE "public"."reachability_job_status" AS ENUM('queued', 'leased', 'completed', 'expired');
CREATE TYPE "public"."user_roles" AS ENUM('admin', 'operator', 'viewer');

-- Core tables
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

CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone,
	"absolute_expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" text,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "auth_sessions_idle_before_absolute_check" CHECK ("auth_sessions"."idle_expires_at" < "auth_sessions"."absolute_expires_at")
);

CREATE TABLE "oidc_auth_flows" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"state_hash" text NOT NULL,
	"state" text NOT NULL,
	"nonce" text NOT NULL,
	"pkce_verifier" text NOT NULL,
	"issuer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "user_roles" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_role_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" integer NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);

-- Indexes
CREATE UNIQUE INDEX "roles_role_unique" ON "roles" USING btree ("role");
CREATE UNIQUE INDEX "user_role_membership_user_role_unique" ON "user_role_memberships" USING btree ("user_id","role_id");

-- Foreign Keys
ALTER TABLE "saved_configurations" ADD CONSTRAINT "saved_configurations_associated_device_id_devices_id_fk" FOREIGN KEY ("associated_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "monitoring_history" ADD CONSTRAINT "monitoring_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "monitoring_incidents" ADD CONSTRAINT "monitoring_incidents_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_incident_id_monitoring_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."monitoring_incidents"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "incident_activity" ADD CONSTRAINT "incident_activity_incident_id_monitoring_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."monitoring_incidents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reachability_jobs" ADD CONSTRAINT "reachability_jobs_collector_id_collectors_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collectors"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "reachability_jobs" ADD CONSTRAINT "reachability_jobs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

-- Additional indexes for monitoring_history
CREATE INDEX "monitoring_history_device_checked_idx" ON "monitoring_history" USING btree ("device_id","checked_at");
CREATE INDEX "monitoring_history_checked_idx" ON "monitoring_history" USING btree ("checked_at");
CREATE INDEX "monitoring_history_idempotency_idx" ON "monitoring_history" USING btree ("idempotency_identifier");

-- Additional indexes for monitoring_incidents
CREATE INDEX "monitoring_incidents_device_started_idx" ON "monitoring_incidents" USING btree ("device_id","started_at");
CREATE INDEX "monitoring_incidents_status_started_idx" ON "monitoring_incidents" USING btree ("status","started_at");
CREATE UNIQUE INDEX "one_open_incident_per_device_idx" ON "monitoring_incidents" USING btree ("device_id") WHERE "monitoring_incidents"."status" = 'open';

-- Additional indexes for notification_deliveries
CREATE INDEX "notification_deliveries_incident_attempted_idx" ON "notification_deliveries" USING btree ("incident_id","attempted_at");
CREATE INDEX "notification_deliveries_status_attempted_idx" ON "notification_deliveries" USING btree ("status","attempted_at");
CREATE INDEX "notification_deliveries_status_next_attempt_idx" ON "notification_deliveries" USING btree ("status","next_attempt_at");

-- Additional indexes for maintenance_history
CREATE INDEX "maintenance_history_device_occurred_idx" ON "maintenance_history" USING btree ("device_id","occurred_at");
CREATE INDEX "maintenance_history_occurred_idx" ON "maintenance_history" USING btree ("occurred_at");

-- Additional indexes for incident_activity
CREATE INDEX "incident_activity_incident_occurred_idx" ON "incident_activity" USING btree ("incident_id","occurred_at");

-- Additional indexes for collectors
CREATE INDEX "collectors_status_last_seen_idx" ON "collectors" USING btree ("status","last_seen_at");

-- Additional indexes for reachability_jobs
CREATE INDEX "reachability_jobs_status_queued_idx" ON "reachability_jobs" USING btree ("status","queued_at");
CREATE INDEX "reachability_jobs_lease_expires_idx" ON "reachability_jobs" USING btree ("lease_expires_at");
CREATE INDEX "reachability_jobs_collector_status_idx" ON "reachability_jobs" USING btree ("collector_id","status");
CREATE INDEX "reachability_jobs_device_queued_idx" ON "reachability_jobs" USING btree ("device_id","queued_at");
CREATE UNIQUE INDEX "reachability_jobs_one_active_per_device_idx" ON "reachability_jobs" USING btree ("device_id") WHERE "reachability_jobs"."status" in ('queued', 'leased');

-- Additional indexes for auth_sessions
CREATE INDEX "auth_sessions_expiry_idx" ON "auth_sessions" USING btree ("expires_at");
CREATE INDEX "auth_sessions_last_seen_idx" ON "auth_sessions" USING btree ("expires_at");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");

-- Additional indexes for oidc_auth_flows
CREATE INDEX "oidc_auth_flows_expires_idx" ON "oidc_auth_flows" USING btree ("expires_at");

-- Additional indexes for monitor
CONSTRAINT "monitoring_incidents_peak_failures_nonnegative" CHECK ("monitoring_incidents"."peak_failures" >= 0);
CONSTRAINT "monitoring_incidents_duration_nonnegative" CHECK ("monitoring_incidents"."duration_seconds" is null or "monitoring_incidents"."duration_seconds" >= 0);
CONSTRAINT "monitoring_history_device_checked_idx_device_id_key" UNIQUE ("device_id","checked_at");

-- Notifications enum (needed for notification_deliveries)
CREATE TYPE "notification_type" AS ENUM('email', 'webhook', 'sms');

ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_incident_id_monitoring_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."monitoring_incidents"("id") ON DELETE set null ON UPDATE no action;