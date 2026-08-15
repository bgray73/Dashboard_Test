import { boolean, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    identityIssuer: text("identity_issuer").notNull(),
    identitySubject: text("identity_subject").notNull(),
    email: text("email"),
    displayName: text("display_name"),
    emailVerified: boolean("email_verified"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [unique("users_identity_issuer_subject_unique").on(table.identityIssuer, table.identitySubject)],
);

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
