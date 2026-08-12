import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { devicesTable } from "./devices";

export const maintenanceHistoryTable = pgTable("maintenance_history", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  maintenanceStartsAt: timestamp("maintenance_starts_at", { withTimezone: true }),
  maintenanceEndsAt: timestamp("maintenance_ends_at", { withTimezone: true }),
}, (table) => [
  index("maintenance_history_device_occurred_idx").on(table.deviceId, table.occurredAt),
  index("maintenance_history_occurred_idx").on(table.occurredAt),
]);

export type MaintenanceHistory = typeof maintenanceHistoryTable.$inferSelect;
