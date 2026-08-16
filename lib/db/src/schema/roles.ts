import { pgEnum, pgTable, serial, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

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
    userId: serial("user_id").notNull(),
    roleId: serial("role_id").notNull(),
    grantedBy: serial("granted_by"),
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