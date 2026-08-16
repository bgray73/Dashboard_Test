/**
 * Phase 20-23: Role Management API
 *
 * Administrator-only endpoints for managing user roles stored in the database.
 */

import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { z } from "zod";
import { db } from "@workspace/db";
import { rolesTable, userRoleMembershipsTable, usersTable } from "@workspace/db";
import { and, asc, count, eq } from "drizzle-orm";
import type { Role } from "../lib/authorization";

// Request validation schemas
const RoleAssignmentSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(["viewer", "operator", "administrator"]),
});

const RoleRevocationSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(["viewer", "operator", "administrator"]),
});

export interface RoleManagementRouterOptions {
  logger: Logger;
}

/**
 * Map authorization role to database role
 */
function authRoleToDbRole(role: Role): "admin" | "operator" | "viewer" {
  if (role === "administrator") return "admin";
  return role;
}

/**
 * GET /api/roles - List all available roles
 */
async function listRoles(_req: any, res: any): Promise<void> {
  const roles = await db
    .select({
      id: rolesTable.id,
      role: rolesTable.role,
      description: rolesTable.description,
      createdAt: rolesTable.createdAt,
    })
    .from(rolesTable)
    .orderBy(asc(rolesTable.role));

  res.json({
    roles: roles.map((r) => ({
      id: r.id,
      value: r.role === "admin" ? "administrator" : r.role,
      label: r.role === "admin" ? "Administrator" : (r.role.charAt(0).toUpperCase() + r.role.slice(1)),
      description: r.description,
      createdAt: r.createdAt,
    })),
  });
}

/**
 * GET /api/roles/users/:userId - Get roles for a specific user
 */
async function getUserRoles(req: any, res: any): Promise<void> {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  // First check if user exists
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Get the user's role memberships
  const memberships = await db
    .select({
      roleId: userRoleMembershipsTable.roleId,
      role: rolesTable.role,
      description: rolesTable.description,
      grantedAt: userRoleMembershipsTable.grantedAt,
    })
    .from(userRoleMembershipsTable)
    .innerJoin(rolesTable, eq(userRoleMembershipsTable.roleId, rolesTable.id))
    .where(eq(userRoleMembershipsTable.userId, userId))
    .orderBy(asc(rolesTable.role));

  res.json({
    userId,
    roles: memberships.map((m) => ({
      roleId: m.roleId,
      role: m.role === "admin" ? "administrator" : m.role,
      description: m.description,
      grantedAt: m.grantedAt,
    })),
  });
}

/**
 * POST /api/roles/assign - Assign a role to a user
 */
async function assignRole(req: any, res: any, logger: Logger): Promise<void> {
  const parsed = RoleAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    return;
  }

  const { userId, role } = parsed.data;
  const dbRole = authRoleToDbRole(role as Role);

  // Verify user exists
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Verify role exists in database
  const [roleRow] = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.role, dbRole))
    .limit(1);
  if (!roleRow) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  // Check if role already assigned
  const [existingMembership] = await db
    .select()
    .from(userRoleMembershipsTable)
    .where(
      and(
        eq(userRoleMembershipsTable.userId, userId),
        eq(userRoleMembershipsTable.roleId, roleRow.id)
      )
    )
    .limit(1);

  if (existingMembership) {
    res.json({ userId, role, success: true, alreadyHad: true });
    return;
  }

  // Assign role
  await db.insert(userRoleMembershipsTable).values({
    userId,
    roleId: roleRow.id,
  });

  logger.info({ event: "role_assigned", userId, role });
  res.json({ userId, role, success: true });
}

/**
 * DELETE /api/roles/revoke - Revoke a role from a user
 */
async function revokeRole(req: any, res: any, logger: Logger): Promise<void> {
  const parsed = RoleRevocationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
    return;
  }

  const { userId, role } = parsed.data;
  const dbRole = authRoleToDbRole(role as Role);

  // Verify role exists
  const [roleRow] = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.role, dbRole))
    .limit(1);
  if (!roleRow) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  // Check if membership exists
  const [existingMembership] = await db
    .select()
    .from(userRoleMembershipsTable)
    .where(
      and(
        eq(userRoleMembershipsTable.userId, userId),
        eq(userRoleMembershipsTable.roleId, roleRow.id)
      )
    )
    .limit(1);

  if (!existingMembership) {
    res.json({ userId, role, success: true, alreadyHad: false });
    return;
  }

  // Revoke role
  await db.delete(userRoleMembershipsTable).where(eq(userRoleMembershipsTable.id, existingMembership.id));

  logger.info({ event: "role_revoked", userId, role });
  res.json({ userId, role, success: true });
}

/**
 * GET /api/roles/summary - Get role assignment statistics
 */
async function getRolesSummary(_req: any, res: any): Promise<void> {
  // Get all role definitions
  const roleDefs = await db
    .select({ role: rolesTable.role })
    .from(rolesTable)
    .orderBy(asc(rolesTable.role));

  const roleCounts: Record<string, number> = {};
  for (const r of roleDefs) {
    const roleKey = r.role === "admin" ? "administrator" : r.role;
    roleCounts[roleKey] = 0;
  }

  const counts = await db
    .select({
      role: rolesTable.role,
      cnt: count(),
    })
    .from(userRoleMembershipsTable)
    .innerJoin(rolesTable, eq(userRoleMembershipsTable.roleId, rolesTable.id))
    .groupBy(rolesTable.role);

  for (const c of counts) {
    const roleKey = c.role === "admin" ? "administrator" : c.role;
    roleCounts[roleKey] = Number(c.cnt);
  }

  res.json({
    roleCounts,
    totalUsersWithRoles: Object.keys(roleCounts).filter((k) => roleCounts[k] > 0).length,
    totalRoleAssignments: roleCounts.viewer + roleCounts.operator + roleCounts.administrator,
  });
}

/**
 * Create the role management router
 */
export function createRoleManagementRouter(options: RoleManagementRouterOptions): { routes: Array<{ path: string; method: string; handler: RequestHandler }> } {
  const { logger } = options;

  return {
    routes: [
      { path: "/api/roles", method: "get", handler: listRoles },
      { path: "/api/roles/users/:userId", method: "get", handler: getUserRoles },
      { path: "/api/roles/assign", method: "post", handler: (req, res, next) => assignRole(req, res, logger) as any },
      { path: "/api/roles/revoke", method: "delete", handler: (req, res, next) => revokeRole(req, res, logger) as any },
      { path: "/api/roles/summary", method: "get", handler: getRolesSummary },
    ],
  };
}

/**
 * Role definitions for documentation
 */
export const roleDefinitions = [
  { value: "viewer" as const, label: "Viewer", description: "Read access to dashboards, inventory, monitoring, incidents, and reports" },
  { value: "operator" as const, label: "Operator", description: "Viewer plus checks, maintenance, and incident acknowledgment" },
  { value: "administrator" as const, label: "Administrator", description: "Full access including configuration, roles, retention, notifications, and collector lifecycle" },
] as const;