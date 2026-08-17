-- LabOps Database Migration
-- Minimal working schema

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
CREATE TYPE IF NOT EXISTS collector_status AS ENUM ('active', 'revoked');
CREATE TYPE IF NOT EXISTS reachability_job_status AS ENUM ('queued', 'leased', 'completed', 'expired');
CREATE TYPE IF NOT EXISTS user_roles AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE IF NOT EXISTS notification_type AS ENUM ('email', 'webhook', 'sms');

-- Core tables
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    hostname TEXT NOT NULL,
    management_ip TEXT NOT NULL,
    device_type TEXT NOT NULL,
    vendor TEXT NOT NULL,
    model TEXT DEFAULT '' NOT NULL,
    operating_system TEXT DEFAULT '' NOT NULL,
    location TEXT DEFAULT '' NOT NULL,
    serial_number TEXT DEFAULT '' NOT NULL,
    notes TEXT DEFAULT '' NOT NULL,
    monitoring_enabled BOOLEAN DEFAULT false NOT NULL,
    maintenance_mode BOOLEAN DEFAULT false NOT NULL,
    maintenance_starts_at TIMESTAMP WITH TIME ZONE,
    maintenance_ends_at TIMESTAMP WITH TIME ZONE,
    monitoring_interval_seconds INTEGER DEFAULT 60 NOT NULL,
    last_status TEXT DEFAULT 'unknown' NOT NULL,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_latency_ms INTEGER,
    consecutive_failures INTEGER DEFAULT 0 NOT NULL,
    is_sample BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
    identity_issuer TEXT NOT NULL,
    identity_subject TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    email_verified BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT users_identity_issuer_subject_unique UNIQUE (identity_issuer, identity_subject)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    idle_expires_at TIMESTAMP WITH TIME ZONE,
    absolute_expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,
    ip_address TEXT,
    CONSTRAINT auth_sessions_token_hash_unique UNIQUE (token_hash),
    CONSTRAINT auth_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    "role" user_roles NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS user_role_memberships (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    granted_by TEXT,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT user_role_memberships_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT user_role_memberships_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT user_role_memberships_granted_by_users_id_fk FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS oidc_auth_flows (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
    state_hash TEXT NOT NULL,
    state TEXT NOT NULL,
    nonce TEXT NOT NULL,
    pkce_verifier TEXT NOT NULL,
    issuer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS collectors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    hostname TEXT,
    token_hash TEXT NOT NULL,
    status collector_status DEFAULT 'active' NOT NULL,
    capabilities JSONB DEFAULT '["icmp"]'::JSONB NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT collectors_name_unique UNIQUE (name),
    CONSTRAINT collectors_token_hash_unique UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS reachability_jobs (
    id SERIAL PRIMARY KEY,
    collector_id INTEGER,
    device_id INTEGER NOT NULL,
    target TEXT NOT NULL,
    status reachability_job_status DEFAULT 'queued' NOT NULL,
    timeout_ms INTEGER DEFAULT 5000 NOT NULL,
    attempt_count INTEGER DEFAULT 0 NOT NULL,
    lease_id TEXT,
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    result_status TEXT,
    latency_ms INTEGER,
    error_code TEXT,
    error_message TEXT,
    result_digest TEXT,
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    leased_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT reachability_jobs_timeout_positive CHECK (timeout_ms > 0),
    CONSTRAINT reachability_jobs_timeout_bounded CHECK (timeout_ms <= 30000),
    CONSTRAINT reachability_jobs_attempt_count_nonnegative CHECK (attempt_count >= 0),
    CONSTRAINT reachability_jobs_result_status_valid CHECK (result_status IS NULL OR result_status IN ('online', 'offline', 'unknown')),
    CONSTRAINT reachability_jobs_lease_consistent CHECK (status <> 'leased' OR (collector_id IS NOT NULL AND lease_id IS NOT NULL AND lease_expires_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS monitoring_history (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    error_message TEXT,
    consecutive_failures INTEGER DEFAULT 0 NOT NULL,
    source TEXT DEFAULT 'automated' NOT NULL,
    idempotency_identifier TEXT,
    CONSTRAINT monitoring_history_device_checked_idx_device_id_key UNIQUE (device_id, checked_at),
    CONSTRAINT monitoring_history_device_id_devices_id_fk FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS monitoring_incidents (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_failure_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'open' NOT NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by TEXT,
    operator_note TEXT,
    peak_failures INTEGER DEFAULT 0 NOT NULL,
    duration_seconds INTEGER,
    error_message TEXT,
    resolution_reason TEXT,
    idempotency_identifier TEXT,
    CONSTRAINT monitoring_incidents_peak_failures_nonnegative CHECK (peak_failures >= 0),
    CONSTRAINT monitoring_incidents_device_id_devices_id_fk FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER,
    event_type notification_type NOT NULL,
    destination TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    response_status INTEGER,
    error_message TEXT,
    payload JSONB NOT NULL,
    attempt_count INTEGER DEFAULT 0 NOT NULL,
    next_attempt_at TIMESTAMP WITH TIME ZONE,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT notification_deliveries_incident_id_monitoring_incidents_id_fk FOREIGN KEY (incident_id) REFERENCES monitoring_incidents(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS maintenance_history (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    maintenance_starts_at TIMESTAMP WITH TIME ZONE,
    maintenance_ends_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT maintenance_history_device_id_devices_id_fk FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS incident_activity (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    actor TEXT,
    note TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT incident_activity_incident_id_monitoring_incidents_id_fk FOREIGN KEY (incident_id) REFERENCES monitoring_incidents(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Indexes
CREATE INDEX IF NOT EXISTS roles_role_unique ON roles ("role");
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS oidc_auth_flows_expires_idx ON oidc_auth_flows (expires_at);