import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  hostname: text("hostname").notNull(),
  managementIp: text("management_ip").notNull(),
  deviceType: text("device_type").notNull(),
  vendor: text("vendor").notNull(),
  model: text("model").notNull().default(""),
  operatingSystem: text("operating_system").notNull().default(""),
  location: text("location").notNull().default(""),
  serialNumber: text("serial_number").notNull().default(""),
  notes: text("notes").notNull().default(""),
  monitoringEnabled: boolean("monitoring_enabled").notNull().default(false),
  lastStatus: text("last_status").notNull().default("unknown"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  isSample: boolean("is_sample").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;