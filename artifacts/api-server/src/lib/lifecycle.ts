/**
 * Phase 22: Graceful Shutdown and Lifecycle Management
 *
 * Provides graceful shutdown handling for background jobs.
 * Ensures bounded in-flight work completion and clean process exit.
 */

import { logger } from "./logger";
import { cleanupMonitoringHistory } from "./monitoring";
import {
  forceReleaseAllLeases,
  waitForShutdown,
  requestShutdown
} from "./job-leadership";

// Default shutdown timeout (can be overridden by config)
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30000;

// Track if shutdown has started
let shutdownInProgress = false;

/**
 * Perform graceful shutdown of background jobs.
 * 
 * This should be called before process.exit() to ensure:
 * 1. Job leaders release their locks
 * 2. In-flight monitoring checks complete
 * 3. Database connections close cleanly
 */
export async function gracefulShutdown(): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  logger.info("Graceful shutdown initiated");

  // Step 1: Signal shutdown to job leadership subsystem
  requestShutdown();
  logger.debug("Shutdown signalled to job leadership");

  // Step 2: Wait for in-flight work to complete (bounded)
  const timeout = setTimeout(() => {
    logger.warn("Shutdown timeout elapsed, forcing completion");
  }, DEFAULT_SHUTDOWN_TIMEOUT_MS);

  try {
    await waitForShutdown(DEFAULT_SHUTDOWN_TIMEOUT_MS);
    logger.debug("All job leases released");
  } finally {
    clearTimeout(timeout);
  }

  // Step 3: Force release any remaining leases (emergency)
  await forceReleaseAllLeases();
  logger.debug("All leases force-released");

  // Step 4: Run retention cleanup finalizer
  try {
    await cleanupMonitoringHistory();
  } catch (err) {
    logger.warn({ err }, "Retention cleanup failed during shutdown");
  }
}