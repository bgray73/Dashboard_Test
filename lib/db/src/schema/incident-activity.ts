import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { monitoringIncidentsTable } from "./monitoring-incidents";

export const incidentActivityTable = pgTable("incident_activity", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull().references(() => monitoringIncidentsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actor: text("actor"),
  note: text("note"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("incident_activity_incident_occurred_idx").on(table.incidentId, table.occurredAt)]);

export type IncidentActivity = typeof incidentActivityTable.$inferSelect;
