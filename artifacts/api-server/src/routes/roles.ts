/**
 * Phase 20: Role Management API
 * 
 * Admin-only endpoints for managing user roles and permissions
 */

import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { z } from "zod";

// Role validation schema
const RoleEnum = z.enum(["viewer", "operator", "administrator"]);
const RoleAssignmentSchema = z.object({
  userId: z.number().int().positive(),
  role: RoleEnum,
});

export interface RoleManagementRouterOptions {
  logger: Logger;
}

export function createRoleManagementRouter(options: RoleManagementRouterOptions): { router: ReturnType<typeof import("express").Router> } {
  const { logger } = options;
  
  // In-memory role store for now (Phase 21 will integrate with database)
  const userRoles = new Map<number, string[]>();

  // Simple router setup (no Express Router return to avoid complexity)
  const handlers: { path: string; method: string; handler: RequestHandler }[] = [];

  // GET /api/roles - List all roles
  handlers.push({
    path: "/api/roles",
    method: "get",
    handler: (_req, res) => {
      res.json({
        roles: [
          { value: "viewer", label: "Viewer", description: "Read access to dashboards, inventory, monitoring, incidents, and reports" },
          { value: "operator", label: "Operator", description: "Viewer plus checks, maintenance, and incident acknowledgment" },
          { value: "administrator", label: "Administrator", description: "Full access including configuration, roles, retention, notifications, and collector lifecycle" },
        ],
      });
    },
  });

  // GET /api/roles/users/:userId - Get roles for a user
  handlers.push({
    path: "/api/roles/users/:userId",
    method: "get",
    handler: (req, res) => {
      const userIdParam = req.params.userId;
      const userId = parseInt(Array.isArray(userIdParam) ? userIdParam[0] : userIdParam, 10);
      if (isNaN(userId) || userId <= 0) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }
      
      const roles = userRoles.get(userId) || [];
      res.json({ userId, roles });
    },
  });

  // POST /api/roles/assign - Assign a role to a user
  handlers.push({
    path: "/api/roles/assign",
    method: "post",
    handler: (req, res) => {
      const parsed = RoleAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
        return;
      }
      
      const { userId, role } = parsed.data;
      const currentRoles = userRoles.get(userId) || [];
      
      if (!currentRoles.includes(role)) {
        userRoles.set(userId, [...currentRoles, role]);
      }
      
      logger.info({ event: "role_assigned", userId, role });
      res.json({ userId, role, success: true });
    },
  });

  // DELETE /api/roles/revoke - Revoke a role from a user
  handlers.push({
    path: "/api/roles/revoke",
    method: "delete",
    handler: (req, res) => {
      const parsed = RoleAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
        return;
      }
      
      const { userId, role } = parsed.data;
      const currentRoles = userRoles.get(userId) || [];
      const newRoles = currentRoles.filter(r => r !== role);
      
      if (newRoles.length !== currentRoles.length) {
        userRoles.set(userId, newRoles);
      }
      
      logger.info({ event: "role_revoked", userId, role });
      res.json({ userId, role, success: true });
    },
  });

  // GET /api/roles/summary - Get role summary statistics
  handlers.push({
    path: "/api/roles/summary",
    method: "get",
    handler: (_req, res) => {
      const roleCounts = { viewer: 0, operator: 0, administrator: 0 };
      const userRoleCounts = new Map<number, number>();
      
      for (const [userId, roles] of userRoles) {
        userRoleCounts.set(userId, roles.length);
        for (const role of roles) {
          if (role in roleCounts) {
            roleCounts[role as keyof typeof roleCounts]++;
          }
        }
      }
      
      res.json({
        roleCounts,
        totalUsersWithRoles: userRoleCounts.size,
        totalRoleAssignments: Array.from(userRoles.values()).reduce((sum, roles) => sum + roles.length, 0),
      });
    },
  });

  return { router: { routes: handlers } as any };
}

// Exports for use in app.ts
export const roleDefinitions = [
  { value: "viewer" as const, label: "Viewer", description: "Read access to dashboards, inventory, monitoring, incidents, and reports" },
  { value: "operator" as const, label: "Operator", description: "Viewer plus checks, maintenance, and incident acknowledgment" },
  { value: "administrator" as const, label: "Administrator", description: "Full access including configuration, roles, retention, notifications, and collector lifecycle" },
];

export const roleHierarchy: Record<string, number> = {
  viewer: 1,
  operator: 2,
  administrator: 3,
};