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
  role: Role;
  roles?: string[];
}

export interface AuthSession {
  userId: number;
  user: AuthSessionUser;
}

export type RouteAccessRequirement = Role | "public" | "collector" | "authenticated";

/**
 * Role hierarchy for comparing privileges
 * viewer (1) < operator (2) < administrator (3)
 */
export const roleHierarchy: Record<Role, number> = {
  viewer: 1,
  operator: 2,
  administrator: 3,
};

/**
 * Map database role names to authorization role names
 * Database: admin, operator, viewer
 * Authorization: administrator, operator, viewer
 */
function mapDbRoleToAuthRole(dbRole: string): Role {
  if (dbRole === "admin") return "administrator";
  return dbRole as Role;
}

/**
 * Compute the effective role from a user's assigned roles
 * Returns the highest privilege role, defaults to "viewer"
 */
export function getEffectiveRole(roles: string[]): Role {
  if (!roles || roles.length === 0) return "viewer";
  const mapped = roles.map(mapDbRoleToAuthRole);
  let highest: Role = "viewer";
  let highestLevel = roleHierarchy.viewer;
  for (const role of mapped) {
    const level = roleHierarchy[role];
    if (level && level > highestLevel) {
      highest = role;
      highestLevel = level;
    }
  }
  return highest;
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
  "/api/roles": { get: "viewer", post: "administrator" },
  "/api/roles/users/:userId": { get: "viewer" },
  "/api/roles/assign": { post: "administrator" },
  "/api/roles/revoke": { delete: "administrator" },
  "/api/roles/summary": { get: "administrator" },
  "/api/collectors": { get: "administrator", post: "administrator" },
  
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
  
  // GET /api/roles/users/:userId
  if (method === "GET" && /^\/api\/roles\/users\/\d+$/.test(path)) {
    return "viewer";
  }
  
  // GET, PATCH, DELETE /api/collectors/:id
  if (/^\/api\/collectors\/\d+$/.test(path)) {
    const m = method.toUpperCase();
    if (m === "GET") return "administrator";
    if (m === "PATCH") return "administrator";
    if (m === "DELETE") return "administrator";
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
    const session = (res as any).locals?.auth as AuthSession | undefined;
    
    if (!session) {
      const role = routeRequiresRole(req.path, req.method);
      if (role === "public" || role === "authenticated") {
        return next();
      }
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    
    // Phase 20: Use roles loaded from database instead of hardcoded role
    const userRoles: string[] = (session as any).user?.roles ?? [];
    const effectiveRole = getEffectiveRole(userRoles);
    
    const requiredRole = routeRequiresRole(req.path, req.method);
    
    // Check role-based access
    if (requiredRole !== "public" && requiredRole !== "authenticated" && requiredRole !== "collector") {
      const userLevel = roleHierarchy[effectiveRole];
      const requiredLevel = roleHierarchy[requiredRole as Role];
      
      if (userLevel < requiredLevel) {
        logger.warn({
          event: "authorization_denied",
          outcome: "insufficient_role",
          userId: session.user.id,
          requiredRole,
          userRole: effectiveRole,
          roles: userRoles,
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