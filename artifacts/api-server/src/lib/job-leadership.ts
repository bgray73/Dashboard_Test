/**
 * Phase 22: Background Job Ownership and Leadership
 *
 * Provides PostgreSQL-advisory-lock based leadership for scheduled jobs.
 * Ensures exactly-once execution across multiple API instances.
 */

import { logger } from "./logger";
import { pool } from "@workspace/db";

// Lock keys for different job types (must be < 2^31)
export enum JobLockKey {
  MONITORING = 1001,
  WEBHOOK_DELIVERY = 1002,
  RETENTION_CLEANUP = 1003,
  COLLECTOR_OPERATIONS = 1004,
}

// Configuration for job leases
export interface JobLeaseConfig {
  heartbeatSeconds: number;
  timeoutSeconds: number;
  shutdownGracePeriodSeconds: number;
}

// Default lease configuration per job type
export const DEFAULT_JOB_LEASES: Record<JobLockKey, JobLeaseConfig> = {
  [JobLockKey.MONITORING]: {
    heartbeatSeconds: 15,
    timeoutSeconds: 45,
    shutdownGracePeriodSeconds: 5,
  },
  [JobLockKey.WEBHOOK_DELIVERY]: {
    heartbeatSeconds: 10,
    timeoutSeconds: 30,
    shutdownGracePeriodSeconds: 3,
  },
  [JobLockKey.RETENTION_CLEANUP]: {
    heartbeatSeconds: 60,
    timeoutSeconds: 300,
    shutdownGracePeriodSeconds: 10,
  },
  [JobLockKey.COLLECTOR_OPERATIONS]: {
    heartbeatSeconds: 30,
    timeoutSeconds: 120,
    shutdownGracePeriodSeconds: 8,
  },
};

// Active job leases tracked in this instance
const activeLeases = new Map<JobLockKey, NodeJS.Timeout>();
let shutdownRequested = false;

export interface JobLease {
  jobKey: JobLockKey;
  isLeader: boolean;
  acquiredAt: Date;
  lastHeartbeat: Date;
  deadlineAt: Date;
}

/**
 * Acquire a job lease using PostgreSQL advisory lock.
 * Uses raw SQL since Drizzle ORM doesn't support advisory locks directly.
 */
export async function acquireJobLease(
  jobKey: JobLockKey,
  config: JobLeaseConfig = DEFAULT_JOB_LEASES[jobKey]
): Promise<JobLease> {
  if (shutdownRequested) {
    return { jobKey, isLeader: false, acquiredAt: new Date(), lastHeartbeat: new Date(), deadlineAt: new Date() };
  }

  const now = new Date();
  const deadlineAt = new Date(now.getTime() + config.timeoutSeconds * 1000);

  // Use raw SQL for advisory lock since Drizzle doesn't support it
  const { rows } = await pool.query(
    "SELECT pg_try_advisory_lock($1) as acquired",
    [jobKey]
  );

  const isLeader = Boolean(rows[0]?.acquired);

  if (isLeader) {
    logger.info({ jobKey }, "Acquired job leadership lease");
    
    // Start heartbeat timer
    const heartbeatTimer = setInterval(async () => {
      await pool.query("SELECT pg_advisory_lock($1)", [jobKey]);
      logger.debug({ jobKey }, "Heartbeat for job lease");
    }, config.heartbeatSeconds * 1000);
    
    activeLeases.set(jobKey, heartbeatTimer);
  } else {
    logger.debug({ jobKey }, "Job leadership lease denied - another instance owns it");
  }

  return { jobKey, isLeader, acquiredAt: now, lastHeartbeat: now, deadlineAt };
}

/**
 * Release a job lease by releasing the advisory lock.
 */
export async function releaseJobLease(jobKey: JobLockKey): Promise<void> {
  const timer = activeLeases.get(jobKey);
  if (timer) {
    clearInterval(timer);
    activeLeases.delete(jobKey);
  }

  await pool.query("SELECT pg_advisory_unlock($1)", [jobKey]);

  logger.info({ jobKey }, "Released job leadership lease");
}

/**
 * Check if a job lease is still valid (not expired by heartbeat).
 */
export async function isLeaseValid(jobKey: JobLockKey): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT pg_try_advisory_lock_shared($1) as granted",
    [jobKey]
  );

  const granted = Boolean(rows[0]?.granted);
  
  if (granted) {
    await pool.query("SELECT pg_advisory_unlock_shared($1)", [jobKey]);
  }
  
  return granted;
}

/**
 * Signal graceful shutdown for job leadership.
 */
export function requestShutdown(): void {
  shutdownRequested = true;
  logger.info("Shutdown requested - will complete in-flight work and release locks");
}

/**
 * Wait for all active leases to be released (during shutdown).
 */
export async function waitForShutdown(timeoutMs: number = 30000): Promise<void> {
  const timeout = Date.now() + timeoutMs;
  
  while (activeLeases.size > 0 && Date.now() < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  logger.info({ activeLeases: activeLeases.size }, "Shutdown wait complete");
}

/**
 * Force release all leases (emergency recovery).
 */
export async function forceReleaseAllLeases(): Promise<void> {
  for (const jobKey of Array.from(activeLeases.keys())) {
    try {
      await releaseJobLease(jobKey);
    } catch (error) {
      logger.error({ err: error, jobKey }, "Failed to release lease during force release");
    }
  }
  
  shutdownRequested = true;
}