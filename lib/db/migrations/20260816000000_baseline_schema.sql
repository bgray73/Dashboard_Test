-- Phase 23: Baseline migration representing current database schema
-- This migration captures the schema state established through Phases 1-20
-- It is the foundation for proper versioned migrations going forward
--
-- NOTE: This baseline assumes the schema was previously created via `drizzle-kit push`
-- For existing production databases, this migration should be marked as applied
-- without re-running it (set the hash in drizzle_migrations table)

-- ============================================
-- Phase 1: Required extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Phase 17: Core monitoring tables
-- ============================================

-- Users table (OIDC identity)
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  identity_issuer TEXT NOT NULL,
  identity_subject TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  email_verified BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

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
  monitoring_starts_at TIMESTAMPTZ,
  monitoring_ends_at TIMESTAMPTZ,
  monitoring_interval_seconds INTEGER NOT NULL DEFAULT 60,
  last_status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  last_latency_ms INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monitoring history
CREATE TABLE monitoring_history (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_message TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'automated',
  idempotency_identifier TEXT
);

-- Monitoring incidents
CREATE TABLE monitoring_incidents (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  last_failure_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  operator_note TEXT,
  peak_failures INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  error_message TEXT,
  resolution_reason TEXT,
  idempotency_identifier TEXT
);

-- Incident activity trail
CREATE TABLE incident_activity (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES monitoring_incidents(id) ON DELETE CASCADE,
  acknowledged_by TEXT,
  operator_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reachability jobs (ICMP checks)
CREATE TYPE reachability_job_status AS ENUM ('queued', 'leased', 'completed', 'expired');

CREATE TABLE reachability_jobs (
  id SERIAL PRIMARY KEY,
  collector_id INTEGER REFERENCES collectors(id) ON DELETE SET NULL,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  status reachability_job_status NOT NULL DEFAULT 'queued',
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  result_status TEXT,
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  result_digest TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leased_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================
-- Phase 18: Collector infrastructure
-- ============================================

-- Collectors
CREATE TYPE collector_status AS ENUM ('active', 'revoked');

CREATE TABLE collectors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  hostname TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  status collector_status NOT NULL DEFAULT 'active',
  capabilities TEXT[] NOT NULL DEFAULT ARRAY['icmp'],
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Phase 19: Authorization RBAC
-- ============================================

-- Roles enum and tables
CREATE TYPE user_roles AS ENUM ('admin', 'operator', 'viewer');

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  role user_roles NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_role_memberships (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by TEXT REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE (user_id, role_id)
);

-- Auth sessions
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  idle_expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  CONSTRAINT auth_sessions_idle_before_absolute_check CHECK (idle_expires_at <= absolute_expires_at)
);

-- OIDC auth flows (PKCE state)
CREATE TABLE oidc_auth_flows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  state_hash TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  nonce TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  issuer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT oidc_auth_flows_expiry_check CHECK (expires_at > created_at)
);

-- ============================================
-- Phase 20: SNMP configuration support
-- ============================================

-- Saved configurations
CREATE TABLE saved_configurations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  configuration_type TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_configuration TEXT NOT NULL,
  vendor TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  associated_device_id INTEGER REFERENCES devices(id),
  auth_password_digest TEXT,
  privacy_password_digest TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification deliveries (webhook history)
CREATE TYPE notification_type AS ENUM ('incident_open', 'incident_recovery');

CREATE TABLE notification_deliveries (
  id SERIAL PRIMARY KEY,
  notification_type notification_type NOT NULL,
  incident_id INTEGER REFERENCES monitoring_incidents(id) ON DELETE CASCADE,
  destination_url TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintenance history
CREATE TABLE maintenance_history (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Phase 21: Monitoring concurrency 
-- ============================================

ALTER TABLE monitoring_history 
  ADD COLUMN IF NOT EXISTS idempotency_identifier TEXT;

ALTER TABLE monitoring_incidents
  ADD COLUMN IF NOT EXISTS idempotency_identifier TEXT;

-- ============================================
-- Phase 23: Migrations and Backups infrastructure
-- ============================================

-- Migration tracking table
CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Users
CREATE UNIQUE INDEX IF NOT EXISTS users_identity_issuer_subject_unique 
  ON users(identity_issuer, identity_subject);

-- Devices
CREATE INDEX IF NOT EXISTS devices_hostname_idx ON devices(hostname);
CREATE INDEX IF NOT EXISTS devices_management_ip_idx ON devices(management_ip);
CREATE INDEX IF NOT EXISTS devices_location_idx ON devices(location);

-- Monitoring history
CREATE INDEX IF NOT EXISTS monitoring_history_device_checked_idx ON monitoring_history(device_id, checked_at);
CREATE INDEX IF NOT EXISTS monitoring_history_checked_idx ON monitoring_history(checked_at);

-- Monitoring incidents
CREATE INDEX IF NOT EXISTS monitoring_incidents_device_started_idx ON monitoring_incidents(device_id, started_at);
CREATE INDEX IF NOT EXISTS monitoring_incidents_status_started_idx ON monitoring_incidents(status, started_at);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_incident_per_device_idx
  ON monitoring_incidents(device_id)
  WHERE status = 'open';

-- Reachability jobs
CREATE INDEX IF NOT EXISTS reachability_jobs_status_queued_idx ON reachability_jobs(status, queued_at);
CREATE INDEX IF NOT EXISTS reachability_jobs_lease_expires_idx ON reachability_jobs(lease_expires_at);
CREATE INDEX IF NOT EXISTS reachability_jobs_collector_status_idx ON reachability_jobs(collector_id, status);
CREATE INDEX IF NOT EXISTS reachability_jobs_device_queued_idx ON reachability_jobs(device_id, queued_at);

-- Collectors
CREATE INDEX IF NOT EXISTS collectors_status_last_seen_idx ON collectors(status, last_seen_at);

-- User role memberships
CREATE INDEX IF NOT EXISTS user_role_memberships_expires_at_idx ON user_role_memberships(expires_at);

-- Auth sessions
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_unique ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(idle_expires_at, absolute_expires_at);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_last_seen_idx ON auth_sessions(last_seen_at);

-- OIDC auth flows
CREATE INDEX IF NOT EXISTS oidc_auth_flows_expires_at_idx ON oidc_auth_flows(expires_at);

-- ================================
-- Check constraints
-- ================================

ALTER TABLE monitoring_incidents ADD CONSTRAINT IF NOT EXISTS monitoring_incidents_peak_failures_nonnegative 
  CHECK (peak_failures >= 0);

ALTER TABLE monitoring_incidents ADD CONSTRAINT IF NOT EXISTS monitoring_incidents_duration_nonnegative 
  CHECK (duration_seconds IS NULL OR duration_seconds >= 0);