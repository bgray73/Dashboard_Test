/**
 * Phase 19: Security audit events middleware
 * 
 * Security audit events for compliance and forensics
 */

import type { RequestHandler } from "express";
import type { Logger } from "pino";

export interface AuditEvent {
  event: string;
  outcome: string;
  userId?: number;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  role?: string;
  details?: Record<string, unknown>;
}

/**
 * Security audit levels
 */
export type AuditLevel = "info" | "warn" | "error";

/**
 * Create security audit middleware
 */
export function createSecurityAuditMiddleware(logger: Logger): RequestHandler {
  return async (req, res, next) => {
    const start = Date.now();
    const sessionId = String(req.id || "unknown");
    const userId = (req as any).session?.user?.id;
    const userRole = (req as any).session?.user?.role;
    
    // Log request start
    logger.debug({
      event: "security_audit",
      outcome: "request_started",
      requestId: sessionId,
      userId,
      userRole,
      method: req.method,
      path: req.path,
    });
    
    // Capture response
    const originalEnd = res.end;
    let statusCode = res.statusCode;
    
    (res as any).end = (...args: unknown[]) => {
      const duration = Date.now() - start;
      
      statusCode = res.statusCode;
      
      const event: AuditEvent = {
        event: "security_audit",
        outcome: statusCode < 400 ? "request_completed" : "request_failed",
        userId,
        requestId: sessionId,
        method: req.method,
        path: req.path,
        statusCode,
        role: userRole,
        details: {
          durationMs: duration,
        },
      };
      
      const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
      logger[level](event);
      
      return originalEnd.apply(res, args as any);
    };
    
    next();
  };
}

/**
 * Log authorization events
 */
export function logAuthorizationEvent(
  logger: Logger,
  options: {
    requestId: string;
    userId?: number;
    requiredRole: string;
    userRole?: string;
    method: string;
    path: string;
    outcome: "granted" | "denied";
  },
): void {
  logger.warn({
    event: "authorization_attempt",
    outcome: options.outcome,
    requestId: options.requestId,
    userId: options.userId,
    requiredRole: options.requiredRole,
    userRole: options.userRole,
    method: options.method,
    path: options.path,
  });
}

/**
 * Log privilege escalation events
 */
export function logPrivilegeEscalationEvent(
  logger: Logger,
  options: {
    requestId: string;
    userId: number;
    fromRole: string;
    toRole: string;
    reason?: string;
  },
): void {
  logger.warn({
    event: "privilege_escalation",
    outcome: "escalated",
    requestId: options.requestId,
    userId: options.userId,
    fromRole: options.fromRole,
    toRole: options.toRole,
    reason: options.reason,
  });
}