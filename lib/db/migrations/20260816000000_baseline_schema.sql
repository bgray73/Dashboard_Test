-- Phase 23: Baseline migration - creates all tables from current schema state
-- This file should be applied to fresh databases in CI

-- ============================================
-- Types
-- ============================================

CREATE TYPE collector_status AS ENUM ('active', 'revoked');

CREATE TYPE reachability_job_status AS ENUM ('queued', 'leased', 'completed', 'expired');

CREATE TYPE user_roles AS ENUM ('admin', 'operator', 'viewer');

CREATE TYPE notification_type AS ENUM ('incident_open', 'incident_recovery');

-- ============================================
-- Core Tables
-- ============================================

CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_issuer TEXT NOT NULL,
  identity_subject TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  email_verified BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX users_identity_issuer_subject_unique ON users(identity_issuer, identity_subject);

-- Devices inventory
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  hostname TEXT NOT NULL,
  management_ip TEXT NOT NULL,
  device_type TEXT NOT NULL,
  vendor TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  operating_system TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  monitoring_enabled BOOLEAN NOT NULL DEFAULT false,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_starts_at TIMESTAMP WITH TIME ZONE,
  maintenance_ends_at TIMESTAMP WITH TIME ZONE,
  monitoring_interval_seconds INTEGER NOT NULL DEFAULT 60,
  last_status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMP WITH TIME ZONE,
  last_latency_ms INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX devices_hostname_idx ON devices(hostname);
CREATE INDEX devices_management_ip_idx ON devices(management_ip);
CREATE INDEX devices_location_idx ON devices(location);

-- Monitoring history
CREATE TABLE monitoring_history (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_message TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'automated',
  idempotency_identifier TEXT
);

CREATE INDEX monitoring_history_device_checked_idx ON monitoring_history(device_id, checked_at);
CREATE INDEX monitoring_history_checked_idx ON monitoring_history(checked_at);
CREATE INDEX monitoring_history_idempotency_idx ON monitoring_history(idempotency_identifier);

-- Monitoring incidents
CREATE TABLE monitoring_incidents (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_failure_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'open',
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by TEXT,
  operator_note TEXT,
  peak_failures INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  error_message TEXT,
  resolution_reason TEXT,
  idempotency_identifier TEXT
);

CREATE INDEX monitoring_incidents_device_started_idx ON monitoring_incidents(device_id, started_at);
CREATE INDEX monitoring_incidents_status_started_idx ON monitoring_incidents(status, started_at);
CREATE UNIQUE INDEX one_open_incident_per_device_idx ON monitoring_incidents(device_id) WHERE status = 'open';
ALTER TABLE monitoring_incidents ADD CONSTRAINT monitoring_incidents_peak_failures_nonnegative CHECK (peak_failures >= 0);
ALTER TABLE monitoring_incidents ADD CONSTRAINT monitoring_incidents_duration_nonnegative CHECK (duration_seconds IS NULL OR duration_seconds >= 0);

-- Reachability jobs (ICMP checks)
CREATE TABLE reachability_jobs (
  id SERIAL PRIMARY KEY,
  collector_id INTEGER,
  device_id INTEGER NOT NULL,
  target TEXT NOT NULL,
  status reachability_job_status NOT NULL DEFAULT 'queued',
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  lease_expires_at TIMESTAMP WITH TIME ZONE,
  result_status TEXT,
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  result_digest TEXT,
  queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  leased_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX reachability_jobs_status_queued_idx ON reachability_jobs(status, queued_at);
CREATE INDEX reachability_jobs_lease_expires_idx ON reachability_jobs(lease_expires_at);
CREATE INDEX reachability_jobs_collector_status_idx ON reachability_jobs(collector_id, status);
CREATE INDEX reachability_jobs_device_queued_idx ON reachability_jobs(device_id, queued_at);
CREATE UNIQUE INDEX reachability_jobs_one_active_per_device_idx ON reachability_jobs(device_id) WHERE status IN ('queued', 'leased');

-- ============================================
-- Collector Infrastructure
-- ============================================

-- Collectors
CREATE TABLE collectors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  hostname TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  status collector_status NOT NULL DEFAULT 'active',
  capabilities JSONB NOT NULL DEFAULT '["icmp"]'::jsonb,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX collectors_status_last_seen_idx ON collectors(status, last_seen_at);

-- ============================================
-- Authorization RBAC
-- ============================================

-- Roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  role user_roles NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX roles_role_unique ON roles(role);

CREATE TABLE user_role_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  granted_by INTEGER,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX user_role_membership_user_role_unique ON user_role_memberships(user_id, role_id);

-- ============================================
-- Auth and OIDC
-- ============================================

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  revoked TEXT NOT NULL DEFAULT 'false',
  user_agent TEXT,
  ip_address TEXT,
  CONSTRAINT auth_sessions_token_hash_unique UNIQUE(token_hash),
  CONSTRAINT auth_sessions_idle_before_absolute_check CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
CREATE INDEX auth_sessions_last_seen_idx ON auth_sessions(last_seen_at);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);

CREATE TABLE oidc_auth_flows (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  nonce TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX oidc_auth_flows_expires_idx ON oidc_auth_flows(expires_at);

-- ============================================
-- SNMP Configuration
-- ============================================

-- Saved configurations
CREATE TABLE saved_configurations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  configuration_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Notification deliveries (webhook history)
CREATE TABLE notification_deliveries (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER,
  event_type TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response_status INTEGER,
  error_message TEXT,
  payload JSONB NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP WITH TIME ZONE,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX notification_deliveries_incident_attempted_idx ON notification_deliveries(incident_id, attempted_at);
CREATE INDEX notification_deliveries_status_attempted_idx ON notification_deliveries(status, attempted_at);
CREATE INDEX notification_deliveries_status_next_attempt_idx ON notification_deliveries(status, next_attempt_at);

-- Maintenance history
CREATE TABLE maintenance_history (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  maintenance_starts_at TIMESTAMP WITH TIME ZONE,
  maintenance_ends_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX maintenance_history_device_occurred_idx ON maintenance_history(device_id, occurred_at);
CREATE INDEX maintenance_history_occurred_idx ON maintenance_history(occurred_at);

-- Incident activity trail
CREATE TABLE incident_activity (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  note TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX incident_activity_incident_occurred_idx ON incident_activity(incident_id, occurred_at);

-- ============================================
-- Application Settings
-- ============================================

CREATE TABLE application_settings (
  id SERIAL PRIMARY KEY,
  application_name TEXT NOT NULL DEFAULT 'LabOps',
  default_theme TEXT NOT NULL DEFAULT 'dark',
  default_config_vendor TEXT NOT NULL DEFAULT 'Cisco IOS / IOS-XE',
  ping_timeout_seconds INTEGER NOT NULL DEFAULT 3,
  monitoring_retention_days INTEGER NOT NULL DEFAULT 30,
  webhook_enabled BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- Migration Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);