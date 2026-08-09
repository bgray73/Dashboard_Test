import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const applicationSettingsTable = pgTable("application_settings", {
  id: serial("id").primaryKey(),
  applicationName: text("application_name").notNull().default("LabOps"),
  defaultTheme: text("default_theme").notNull().default("dark"),
  defaultConfigVendor: text("default_config_vendor").notNull().default("Cisco IOS / IOS-XE"),
  pingTimeoutSeconds: integer("ping_timeout_seconds").notNull().default(3),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertApplicationSettingsSchema = createInsertSchema(applicationSettingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertApplicationSettings = z.infer<typeof insertApplicationSettingsSchema>;
export type ApplicationSettings = typeof applicationSettingsTable.$inferSelect;