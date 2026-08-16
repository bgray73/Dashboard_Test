-- Phase 21: Monitoring concurrency and database invariants
-- Adds constraints for atomic monitoring operations

-- Add idempotency_identifier column to monitoring_history
ALTER TABLE monitoring_history ADD COLUMN IF NOT EXISTS idempotency_identifier TEXT;

-- Create index for idempotency lookup
CREATE INDEX IF NOT EXISTS monitoring_history_idempotency_idx ON monitoring_history(idempotency_identifier);

-- Add partial unique index for one open incident per device
-- Note: This requires PostgreSQL 9.4+ for partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_incidents_one_open_per_device 
ON monitoring_incidents(device_id) 
WHERE status = 'open';

-- Create index for faster incident resolution lookups
CREATE INDEX IF NOT EXISTS monitoring_incidents_resolved_idx 
ON monitoring_incidents(device_id, status) 
WHERE status = 'resolved';

-- Safety constraint: ensure peak_failures is always >= 0
ALTER TABLE monitoring_incidents 
ADD CONSTRAINT chk_peak_failures_non_negative 
CHECK (peak_failures >= 0);

-- Safety constraint: ensure duration_seconds is positive when resolved
ALTER TABLE monitoring_incidents 
ADD CONSTRAINT chk_duration_positive_when_resolved 
CHECK (duration_seconds IS NULL OR resolution_reason IS NOT NULL AND duration_seconds >= 0);