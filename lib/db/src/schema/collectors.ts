import { index, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const collectorStatusEnum = pgEnum("collector_status", ["active", "revoked"]);

export const collectorsTable = pgTable("collectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  hostname: text("hostname"),
  tokenHash: text("token_hash").notNull().unique(),
  status: collectorStatusEnum("status").notNull().default("active"),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default(["icmp"]),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("collectors_status_last_seen_idx").on(table.status, table.lastSeenAt),
]);

export const insertCollectorSchema = createInsertSchema(collectorsTable).omit({
  id: true,
  lastSeenAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCollector = z.infer<typeof insertCollectorSchema>;
export type Collector = typeof collectorsTable.$inferSelect;
