import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { monitoringIncidentsTable } from "./monitoring-incidents";

export const notificationDeliveriesTable = pgTable("notification_deliveries", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").references(() => monitoringIncidentsTable.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  destination: text("destination").notNull(),
  status: text("status").notNull().default("pending"),
  responseStatus: integer("response_status"),
  errorMessage: text("error_message"),
  payload: jsonb("payload").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("notification_deliveries_incident_attempted_idx").on(table.incidentId, table.attemptedAt),
  index("notification_deliveries_status_attempted_idx").on(table.status, table.attemptedAt),
]);

export type NotificationDelivery = typeof notificationDeliveriesTable.$inferSelect;
