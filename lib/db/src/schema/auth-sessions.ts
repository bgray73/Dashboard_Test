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
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revoked: text("revoked").notNull().default("false"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
  },
  (table) => [
    index("auth_sessions_expiry_idx").on(table.expiresAt),
    index("auth_sessions_last_seen_idx").on(table.lastSeenAt),
    index("auth_sessions_user_id_idx").on(table.userId),
    check("auth_sessions_idle_before_absolute_check", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export type AuthSession = typeof authSessionsTable.$inferSelect;