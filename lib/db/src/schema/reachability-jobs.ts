import { sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { collectorsTable } from "./collectors";
import { devicesTable } from "./devices";

export const reachabilityJobStatusEnum = pgEnum("reachability_job_status", [
  "queued",
  "leased",
  "completed",
  "expired",
]);

export const reachabilityJobsTable = pgTable("reachability_jobs", {
  id: serial("id").primaryKey(),
  collectorId: integer("collector_id").references(() => collectorsTable.id, { onDelete: "set null" }),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  target: text("target").notNull(),
  status: reachabilityJobStatusEnum("status").notNull().default("queued"),
  timeoutMs: integer("timeout_ms").notNull().default(5_000),
  attemptCount: integer("attempt_count").notNull().default(0),
  leaseId: text("lease_id"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  resultStatus: text("result_status"),
  latencyMs: integer("latency_ms"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  resultDigest: text("result_digest"),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  leasedAt: timestamp("leased_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("reachability_jobs_status_queued_idx").on(table.status, table.queuedAt),
  index("reachability_jobs_lease_expires_idx").on(table.leaseExpiresAt),
  index("reachability_jobs_collector_status_idx").on(table.collectorId, table.status),
  index("reachability_jobs_device_queued_idx").on(table.deviceId, table.queuedAt),
  uniqueIndex("reachability_jobs_one_active_per_device_idx").on(table.deviceId).where(sql`${table.status} in ('queued', 'leased')`),
  check("reachability_jobs_timeout_positive", sql`${table.timeoutMs} > 0`),
  check("reachability_jobs_timeout_bounded", sql`${table.timeoutMs} <= 30000`),
  check("reachability_jobs_attempt_count_nonnegative", sql`${table.attemptCount} >= 0`),
  check("reachability_jobs_latency_nonnegative", sql`${table.latencyMs} is null or ${table.latencyMs} >= 0`),
  check("reachability_jobs_latency_bounded", sql`${table.latencyMs} is null or ${table.latencyMs} <= 3600000`),
  check("reachability_jobs_result_status_valid", sql`${table.resultStatus} is null or ${table.resultStatus} in ('online', 'offline', 'unknown')`),
  check("reachability_jobs_error_code_bounded", sql`${table.errorCode} is null or length(${table.errorCode}) <= 64`),
  check("reachability_jobs_error_message_bounded", sql`${table.errorMessage} is null or length(${table.errorMessage}) <= 512`),
  check("reachability_jobs_lease_consistent", sql`${table.status} <> 'leased' or (${table.collectorId} is not null and ${table.leaseId} is not null and ${table.leaseExpiresAt} is not null)`),
]);

export type ReachabilityJob = typeof reachabilityJobsTable.$inferSelect;
