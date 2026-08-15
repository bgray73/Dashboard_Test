/**
 * Phase 19: Authorization middleware
 * 
 * Middleware for role-based access control on protected routes.
 */

import type { Request, RequestHandler, Response } from "express";
import type { Logger } from "pino";
import type { Role, RouteAccessRequirement } from "./authorization";
import { routeRequiresRole } from "./authorization";

declare global {
  namespace Express {
    interface Request {
      auth: {
        sessionId: number;
        user: { id: number; displayName: string | null; email: string | null };
        roles: Role[];
      };
    }
  }
}

/**
 * Role hierarchy for authorization checks
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 1,
  operator: 2,
  administrator: 3,
};

/**
 * Check if a role satisfies a requirement
 */
function roleSatisfiesRequirement(userRole: Role, requirement: RouteAccessRequirement): boolean {
  if (requirement === "public" || requirement === "authenticated" || requirement === "collector") {
    return true;
  }

  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requirement] || 1;
  return userLevel >= requiredLevel;
}

/**
 * Create authorization middleware for a specific route
 */
export function createRouteAuthorizationMiddleware(logger: Logger): RequestHandler {
  return async (req: Request, res: Response, next: (err?: unknown) => void): Promise<void> => {
    try {
      // Skip if no auth (will be handled by authentication middleware)
      if (!req.auth) {
        // Check if this is a public route
        const requirement = routeRequiresRole(req.path, req.method);
        if (requirement === "public") {
          return next();
        }
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const requirement = routeRequiresRole(req.path, req.method);

      // Check role-based access
      if (requirement !== "public" && requirement !== "authenticated" && requirement !== "collector") {
        const hasAccess = req.auth.roles.some((role) => roleSatisfiesRequirement(role, requirement));

        if (!hasAccess) {
          logger.warn({
            event: "authorization_denied",
            outcome: "insufficient_role",
            userId: req.auth.user.id,
            requiredRole: requirement,
            userRoles: req.auth.roles,
            method: req.method,
            path: req.path,
          });

          res.status(403).json({ error: "Insufficient permissions." });
          return;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware for admin-only access
 */
export function requireAdmin(): RequestHandler {
  return async (req: Request, res: Response, next: (err?: unknown) => void): Promise<void> => {
    try {
      if (!req.auth) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const isAdmin = req.auth.roles.includes("administrator");
      if (!isAdmin) {
        res.status(403).json({ error: "Administrator access required." });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware for operator+ access
 */
export function requireOperator(): RequestHandler {
  return async (req: Request, res: Response, next: (err?: unknown) => void): Promise<void> => {
    try {
      if (!req.auth) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const hasOperatorOrHigher = req.auth.roles.some(
        (role) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.operator,
      );
      if (!hasOperatorOrHigher) {
        res.status(403).json({ error: "Operator access required." });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware for viewer+ access
 */
export function requireViewer(): RequestHandler {
  return async (req: Request, res: Response, next: (err?: unknown) => void): Promise<void> => {
    try {
      if (!req.auth) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }

      const hasViewerOrHigher = req.auth.roles.some(
        (role) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.viewer,
      );
      if (!hasViewerOrHigher) {
        res.status(403).json({ error: "Viewer access required." });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}