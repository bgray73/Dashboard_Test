/**
 * Phase 19-20: Authorization middleware with role-based access control
 * 
 * Roles:
 * - PUBLIC: Liveness and OIDC callback/login mechanics only
 * - VIEWER: Read dashboards, inventory, monitoring, incidents, and reports
 * - OPERATOR: Viewer plus checks, maintenance, and incident acknowledgment
 * - ADMINISTRATOR: Operator plus inventory/configuration mutations, settings, retention, notifications, roles, and collector lifecycle
 */

import type { RequestHandler } from "express";
import type { Logger } from "pino";

export type Role = "viewer" | "operator" | "administrator";

export interface AuthSessionUser {
  id: number;
  displayName: string | null;
  email: string | null;
  roles: string[];
}

export interface AuthSession {
  userId: number;
  user: AuthSessionUser;
}

export type RouteAccessRequirement = Role | "public" | "collector" | "authenticated";

// Role hierarchy for access control - higher number = more permissions
export const roleHierarchy: Record<Role, number> = {
  viewer: 1,
  operator: 2,
  administrator: 3,
};

/**
 * Get the effective role for a user from their role list
 * Returns the highest role the user has
 */
export function getEffectiveRole(roles: string[]): Role | undefined {
  if (roles.includes("administrator")) return "administrator";
  if (roles.includes("operator")) return "operator";
  if (roles.includes("viewer")) return "viewer";
  return undefined;
}

/**
 * Route authorization configuration
 * For each route, specify the minimum required role for each HTTP method
 */
const routeConfig: Record<string, { get?: RouteAccessRequirement; post?: RouteAccessRequirement; patch?: RouteAccessRequirement; delete?: RouteAccessRequirement; default?: RouteAccessRequirement }> = {
  // Public routes - no authentication required
  "/api/healthz": { default: "public" },
  "/api/auth/login": { default: "public" },
  "/api/auth/callback": { default: "public" },
  "/api/auth/me": { default: "public" },
  "/api/auth/logout": { default: "public" },
  "/api/collector/v1": { default: "collector" },
  
  // Dashboard
  "/api/dashboard/summary": { get: "viewer" },
  "/api/dashboard/recent-status": { get: "viewer" },
  "/api/dashboard/check-monitored": { post: "operator" },
  
  // Reports
  "/api/reports/summary": { get: "viewer" },
  "/api/reports/devices.csv": { get: "viewer" },
  "/api/reports/incidents.csv": { get: "viewer" },
  "/api/reports/monitoring-history.csv": { get: "viewer" },
  "/api/reports/availability": { get: "viewer" },
  "/api/reports/availability.csv": { get: "viewer" },
  
  // Incidents
  "/api/incidents": { get: "viewer" },
  "/api/incidents/acknowledgment": { patch: "operator" },
  
  // Monitoring
  "/api/monitoring": { get: "viewer" },
  
  // Maintenance
  "/api/maintenance-history": { get: "viewer" },
  "/api/settings/retention-cleanup": { post: "operator" },
  
  // Settings
  "/api/settings": { get: "viewer", patch: "administrator" },
  "/api/settings/retention-status": { get: "viewer" },
  
  // Notifications
  "/api/notifications/deliveries": { get: "viewer" },
  "/api/notifications/test": { post: "operator" },
  "/api/notifications/deliveries/retry": { post: "operator" },
  
  // Tools
  "/api/tools/reachability-capabilities": { get: "viewer" },
  "/api/tools/ping": { post: "operator" },
  
  // Saved configurations
  "/api/saved-configurations": { get: "viewer", post: "administrator" },
  
  // Devices
  "/api/devices": { get: "viewer", post: "administrator" },
};

/**
 * Check if a route matches a parameterized pattern
 * Returns the role if matched, or undefined if not
 */
function checkParameterizedPattern(path: string, method: string): RouteAccessRequirement | undefined {
  // GET /api/devices/:id
  if (method === "GET" && /^\/api\/devices\/\d+($|\/)/.test(path)) {
    return "viewer";
  }
  
  // PATCH /api/devices/:id
  if (method === "PATCH" && /^\/api\/devices\/\d+$/.test(path)) {
    return "administrator";
  }
  
  // DELETE /api/devices/:id
  if (method === "DELETE" && /^\/api\/devices\/\d+$/.test(path)) {
    return "administrator";
  }
  
  // POST /api/devices/:id/ping
  if (method === "POST" && /^\/api\/devices\/\d+\/ping$/.test(path)) {
    return "operator";
  }
  
  // GET /api/incidents/:id or /api/incidents/:id/activity
  if (method === "GET" && /^\/api\/incidents\/\d+($|\/)/.test(path)) {
    return "viewer";
  }
  
  // PATCH /api/incidents/:id/acknowledgment
  if (method === "PATCH" && /^\/api\/incidents\/\d+\/acknowledgment$/.test(path)) {
    return "operator";
  }
  
  return undefined;
}

/**
 * Convert method string to lowercase key
 */
function getMethodKey(method: string): "get" | "post" | "patch" | "delete" {
  const m = method.toLowerCase();
  if (m === "get") return "get";
  if (m === "post") return "post";
  if (m === "patch") return "patch";
  if (m === "delete") return "delete";
  return "get"; // default
}

/**
 * Check if a route matches a given role requirement
 */
export function routeRequiresRole(path: string, method: string): RouteAccessRequirement {
  const methodUpper = method.toUpperCase();
  
  // Check exact method-specific route first
  const exactRoute = routeConfig[path];
  if (exactRoute) {
    const methodKey = getMethodKey(methodUpper);
    const role = exactRoute[methodKey];
    if (role) return role;
    if (exactRoute.default) return exactRoute.default;
  }
  
  // Check parameterized patterns
  const patternRole = checkParameterizedPattern(path, methodUpper);
  if (patternRole) return patternRole;
  
  // Default: authenticated session required (any role)
  return "authenticated";
}

/**
 * Create authorization middleware
 */
export function createAuthorizationMiddleware(
  logger: Logger,
): RequestHandler {
  return async (req, res, next) => {
    // Get session from res.locals (set by createMainAuthGuard)
    const session = (res as any).locals?.auth;
    
    if (!session) {
      const role = routeRequiresRole(req.path, req.method);
      if (role === "public" || role === "authenticated") {
        return next();
      }
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    
    // Get the effective role for the user from their loaded roles
    const effectiveRole = getEffectiveRole(session.user.roles);
    const sessionUserRole: Role = effectiveRole ?? "viewer";
    
    const requiredRole = routeRequiresRole(req.path, req.method);
    
    // Check role-based access
    if (requiredRole !== "public" && requiredRole !== "authenticated" && requiredRole !== "collector") {
      const requiredLevel = roleHierarchy[requiredRole as Role] || 1;
      const userLevel = roleHierarchy[sessionUserRole] || 0;
      
      if (userLevel < requiredLevel) {
        logger.warn({
          event: "authorization_denied",
          outcome: "insufficient_role",
          userId: session.user.id,
          requiredRole,
          userRole: sessionUserRole,
          userRoles: session.user.roles,
          method: req.method,
          path: req.path,
        });
        
        res.status(403).json({ error: "Insufficient permissions." });
        return;
      }
    }
    
    next();
  };
}

/**
 * Aggregate required role for a route
 */
export function aggregateRouteRole(path: string, method: string): RouteAccessRequirement {
  return routeRequiresRole(path, method);
}