import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { devicesTable } from "./devices";

export const monitoringIncidentsTable = pgTable("monitoring_incidents", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgedBy: text("acknowledged_by"),
  operatorNote: text("operator_note"),
  peakFailures: integer("peak_failures").notNull().default(0),
  durationSeconds: integer("duration_seconds"),
  errorMessage: text("error_message"),
  resolutionReason: text("resolution_reason"),
}, (table) => [
  index("monitoring_incidents_device_started_idx").on(table.deviceId, table.startedAt),
  index("monitoring_incidents_status_started_idx").on(table.status, table.startedAt),
]);

export type MonitoringIncident = typeof monitoringIncidentsTable.$inferSelect;
