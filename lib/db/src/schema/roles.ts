import { pgTable, serial, text, timestamp, foreignKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Phase 20: Roles table for role-based access control
export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  role: text("role").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Role = typeof rolesTable.$inferSelect;
export type NewRole = typeof rolesTable.$inferInsert;

// Phase 20: User-role memberships many-to-many relationship
export const userRoleMembershipsTable = pgTable(
  "user_role_memberships",
  {
    userId: serial("user_id").notNull(),
    roleId: serial("role_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: { columns: [table.userId, table.roleId], name: "user_role_memberships_pk" },
    userFk: foreignKey({ columns: [table.userId], foreignColumns: [usersTable.id], name: "urm_user_id_fkey" }),
    roleFk: foreignKey({ columns: [table.roleId], foreignColumns: [rolesTable.id], name: "urm_role_id_fkey" }),
  }),
);

export type UserRoleMembership = typeof userRoleMembershipsTable.$inferSelect;
export type NewUserRoleMembership = typeof userRoleMembershipsTable.$inferInsert;