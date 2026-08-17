import { index, text, timestamp, check } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const authSessionsTable = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
  },
  (table) => [
    index("auth_sessions_expiry_idx").on(table.expiresAt),
    index("auth_sessions_last_seen_idx").on(table.expiresAt),
    index("auth_sessions_user_id_idx").on(table.userId),
    check("auth_sessions_idle_before_absolute_check", sql`${table.idleExpiresAt} < ${table.absoluteExpiresAt}`),
  ],
);

export type AuthSession = typeof authSessionsTable.$inferSelect;