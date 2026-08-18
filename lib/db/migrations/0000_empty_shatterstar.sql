-- LabOps Database Migration
CREATE TYPE "user_roles" AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE "reachability_job_status" AS ENUM ('queued', 'leased', 'completed', 'expired');
CREATE TYPE "collector_status" AS ENUM ('active', 'revoked');
CREATE TYPE "notification_type" AS ENUM ('slack', 'email', 'webhook');

CREATE TABLE "devices" (
    "id" serial PRIMARY KEY,
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
    "id" serial PRIMARY KEY,
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
    "id" serial PRIMARY KEY,
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
    CONSTRAINT "users_identity_issuer_subject_unique" UNIQUE ("identity_issuer", "identity_subject")
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
    "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
    "user_agent" text,
    "ip_address" text,
    CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT auth_sessions_idle_before_absolute_check CHECK ("idle_expires_at" < "absolute_expires_at")
);

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE ("token_hash");
CREATE INDEX auth_sessions_user_id_idx ON "auth_sessions" ("user_id");
CREATE INDEX auth_sessions_expiry_idx ON "auth_sessions" ("idle_expires_at", "absolute_expires_at");
CREATE INDEX auth_sessions_last_seen_idx ON "auth_sessions" ("last_seen_at");

CREATE TABLE "roles" (
    "id" serial PRIMARY KEY,
    "role" user_roles NOT NULL,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX roles_role_unique ON "roles" ("role");

CREATE TABLE "user_role_memberships" (
    "id" serial PRIMARY KEY,
    "user_id" text NOT NULL,
    "role_id" integer NOT NULL,
    "granted_by" text,
    "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone
);

CREATE UNIQUE INDEX user_role_membership_user_role_unique ON "user_role_memberships" ("user_id", "role_id");

ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "oidc_auth_flows" (
    "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
    "state_hash" text NOT NULL,
    "state" text NOT NULL,
    "nonce" text NOT NULL,
    "pkce_verifier" text NOT NULL,
    "issuer" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT oidc_auth_flows_expiry_check CHECK ("expires_at" > "created_at")
);

ALTER TABLE "oidc_auth_flows" ADD CONSTRAINT "oidc_auth_flows_state_hash_unique" UNIQUE ("state_hash");
CREATE INDEX oidc_auth_flows_expires_at_idx ON "oidc_auth_flows" ("expires_at");

CREATE TABLE "collectors" (
    "id" serial PRIMARY KEY,
    "name" text NOT NULL,
    "hostname" text,
    "token_hash" text NOT NULL,
    "status" collector_status DEFAULT 'active' NOT NULL,
    "capabilities" jsonb DEFAULT '["icmp"]'::jsonb NOT NULL,
    "last_seen_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collectors_name_unique UNIQUE ("name"),
    CONSTRAINT collectors_token_hash_unique UNIQUE ("token_hash")
);

CREATE INDEX collectors_status_last_seen_idx ON "collectors" ("status", "last_seen_at");

CREATE TABLE "reachability_jobs" (
    "id" serial PRIMARY KEY,
    "collector_id" integer,
    "device_id" integer NOT NULL,
    "target" text NOT NULL,
    "status" reachability_job_status DEFAULT 'queued' NOT NULL,
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
    CONSTRAINT reachability_jobs_timeout_positive CHECK ("timeout_ms" > 0),
    CONSTRAINT reachability_jobs_timeout_bounded CHECK ("timeout_ms" <= 30000),
    CONSTRAINT reachability_jobs_attempt_count_nonnegative CHECK ("attempt_count" >= 0),
    CONSTRAINT reachability_jobs_result_status_valid CHECK ("result_status" IS NULL OR "result_status" IN ('online', 'offline', 'unknown')),
    CONSTRAINT reachability_jobs_latency_nonnegative CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0),
    CONSTRAINT reachability_jobs_latency_bounded CHECK ("latency_ms" IS NULL OR "latency_ms" <= 3600000),
    CONSTRAINT reachability_jobs_error_code_bounded CHECK ("error_code" IS NULL OR length("error_code") <= 64),
    CONSTRAINT reachability_jobs_error_message_bounded CHECK ("error_message" IS NULL OR length("error_message") <= 512),
    CONSTRAINT reachability_jobs_lease_consistent CHECK ("status" <> 'leased' OR ("collector_id" IS NOT NULL AND "lease_id" IS NOT NULL AND "lease_expires_at" IS NOT NULL))
);

ALTER TABLE "reachability_jobs" ADD CONSTRAINT "reachability_jobs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "reachability_jobs" ADD CONSTRAINT "reachability_jobs_collector_id_collectors_id_fk" FOREIGN KEY ("collector_id") REFERENCES "collectors" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX reachability_jobs_device_queued_idx ON "reachability_jobs" ("device_id", "queued_at");
CREATE INDEX reachability_jobs_status_queued_idx ON "reachability_jobs" ("status", "queued_at");
CREATE INDEX reachability_jobs_collector_status_idx ON "reachability_jobs" ("collector_id", "status");
CREATE INDEX reachability_jobs_lease_expires_idx ON "reachability_jobs" ("lease_expires_at");
CREATE UNIQUE INDEX reachability_jobs_one_active_per_device_idx ON "reachability_jobs" ("device_id") WHERE "status" IN ('queued', 'leased');

CREATE TABLE "monitoring_history" (
    "id" serial PRIMARY KEY,
    "device_id" integer NOT NULL,
    "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
    "status" text NOT NULL,
    "latency_ms" integer,
    "error_message" text,
    "consecutive_failures" integer DEFAULT 0 NOT NULL,
    "source" text DEFAULT 'automated' NOT NULL,
    "idempotency_identifier" text
);

ALTER TABLE "monitoring_history" ADD CONSTRAINT "monitoring_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX monitoring_history_device_checked_idx_device_id_key ON "monitoring_history" ("device_id", "checked_at");
CREATE INDEX monitoring_history_checked_idx ON "monitoring_history" ("checked_at");
CREATE INDEX monitoring_history_idempotency_idx ON "monitoring_history" ("idempotency_identifier");

CREATE TABLE "monitoring_incidents" (
    "id" serial PRIMARY KEY,
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
    CONSTRAINT monitoring_incidents_peak_failures_nonnegative CHECK ("peak_failures" >= 0),
    CONSTRAINT monitoring_incidents_duration_nonnegative CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0)
);

ALTER TABLE "monitoring_incidents" ADD CONSTRAINT "monitoring_incidents_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX monitoring_incidents_device_started_idx ON "monitoring_incidents" ("device_id", "started_at");
CREATE INDEX monitoring_incidents_status_started_idx ON "monitoring_incidents" ("status", "started_at");
CREATE UNIQUE INDEX one_open_incident_per_device_idx ON "monitoring_incidents" ("device_id") WHERE "status" = 'open';

CREATE TABLE "notification_deliveries" (
    "id" serial PRIMARY KEY,
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

ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_incident_id_monitoring_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "monitoring_incidents" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX notification_deliveries_incident_attempted_idx ON "notification_deliveries" ("incident_id", "attempted_at");
CREATE INDEX notification_deliveries_status_attempted_idx ON "notification_deliveries" ("status", "attempted_at");
CREATE INDEX notification_deliveries_status_next_attempt_idx ON "notification_deliveries" ("status", "next_attempt_at");

CREATE TABLE "maintenance_history" (
    "id" serial PRIMARY KEY,
    "device_id" integer NOT NULL,
    "event_type" text NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
    "maintenance_starts_at" timestamp with time zone,
    "maintenance_ends_at" timestamp with time zone
);

ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX maintenance_history_device_occurred_idx ON "maintenance_history" ("device_id", "occurred_at");
CREATE INDEX maintenance_history_occurred_idx ON "maintenance_history" ("occurred_at");

CREATE TABLE "incident_activity" (
    "id" serial PRIMARY KEY,
    "incident_id" integer NOT NULL,
    "event_type" text NOT NULL,
    "actor" text,
    "note" text,
    "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "incident_activity" ADD CONSTRAINT "incident_activity_incident_id_monitoring_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "monitoring_incidents" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;