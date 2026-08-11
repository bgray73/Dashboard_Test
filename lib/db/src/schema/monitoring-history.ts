import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { devicesTable } from "./devices";

export const monitoringHistoryTable = pgTable("monitoring_history", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull(),
  latencyMs: integer("latency_ms"),
  errorMessage: text("error_message"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  source: text("source").notNull().default("automated"),
}, (table) => [
  index("monitoring_history_device_checked_idx").on(table.deviceId, table.checkedAt),
  index("monitoring_history_checked_idx").on(table.checkedAt),
]);

export type MonitoringHistory = typeof monitoringHistoryTable.$inferSelect;
