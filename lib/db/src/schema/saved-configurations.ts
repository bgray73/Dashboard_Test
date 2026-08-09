import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedConfigurationsTable = pgTable("saved_configurations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  vendor: text("vendor").notNull(),
  configurationType: text("configuration_type").notNull(),
  associatedDeviceId: integer("associated_device_id"),
  generatedConfiguration: text("generated_configuration").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSavedConfigurationSchema = createInsertSchema(savedConfigurationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSavedConfiguration = z.infer<typeof insertSavedConfigurationSchema>;
export type SavedConfiguration = typeof savedConfigurationsTable.$inferSelect;