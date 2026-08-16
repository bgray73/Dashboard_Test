import { integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userRolesEnum = pgEnum("user_roles", ["admin", "operator", "viewer"]);

export const rolesTable = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    role: userRolesEnum("role").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("roles_role_unique").on(table.role)],
);

export const userRoleMembershipsTable = pgTable(
  "user_role_memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
    grantedBy: integer("granted_by").references(() => usersTable.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("user_role_membership_user_role_unique").on(table.userId, table.roleId),
  ],
);

export type Role = typeof rolesTable.$inferSelect;
export type NewRole = typeof rolesTable.$inferInsert;
export type UserRoleMembership = typeof userRoleMembershipsTable.$inferSelect;
export type NewUserRoleMembership = typeof userRoleMembershipsTable.$inferInsert;