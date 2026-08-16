/**
 * Phase 18: Security Audit Events Logging
 *
 * Records security-sensitive activities for compliance and forensic analysis.
 */

import type { RequestHandler } from "express";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * Audit event levels
 */
export const AuditLevel = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type AuditLevel = typeof AuditLevel[keyof typeof AuditLevel];

/**
 * Audit event categories
 */
export const AuditCategory = {
  AUTH: "auth",
  AUTHZ: "authz",
  DATA: "data",
  CONFIG: "config",
  SYSTEM: "system",
} as const;

export type AuditCategory = typeof AuditCategory[keyof typeof AuditCategory];

/**
 * Audit event types
 */
export const AuditEventType = {
  // Authentication events
  LOGIN_SUCCESS: "login.success",
  LOGIN_FAILURE: "login.failure",
  LOGOUT: "logout",
  SESSION_CREATE: "session.create",
  SESSION_EXPIRE: "session.expire",
  
  // Authorization events
  ACCESS_GRANTED: "authz.granted",
  ACCESS_DENIED: "authz.denied",
  
  // Data access/modification
  DATA_READ: "data.read",
  DATA_CREATE: "data.create",
  DATA_UPDATE: "data.update",
  DATA_DELETE: "data.delete",
  
  // Configuration changes
  CONFIG_UPDATE: "config.update",
  
  // System events
  SYSTEM_START: "system.start",
  SYSTEM_SHUTDOWN: "system.shutdown",
  SYSTEM_ERROR: "system.error",
} as const;

export type AuditEventType = typeof AuditEventType[keyof typeof AuditEventType];

/**
 * Create audit events middleware
 */
export function createAuditLogging(): RequestHandler {
  return async (req, res, next) => {
    // Generate a unique request ID if not present
    const requestId = req.id || Math.random().toString(36).substr(2, 9);
    
    // Store request ID for use in route handlers
    // @ts-ignore - extending Request type
    req.auditRequestId = requestId;
    
    // Wrap res.send to capture response status for audit
    const originalSend = res.send;
    res.send = function(body: any) {
      // Log the request/response after processing
      
      // Skip logging for certain paths to reduce noise
      const skipPaths = ["/__body", "/__request-info", "/favicon.ico"];
      if (skipPaths.some(path => req.path.includes(path))) {
        return originalSend.call(this, body);
      }
      
      // Determine audit level based on status code
      let level: AuditLevel = AuditLevel.INFO;
      if (res.statusCode >= 500) {
        level = AuditLevel.ERROR;
      } else if (res.statusCode >= 400) {
        level = AuditLevel.WARN;
      }
      
      // Log audit event (fire and don't wait - don't block response)
      try {
        logger.info({
          event: "audit_log",
          level,
          category: AuditCategory.SYSTEM,
          type: AuditEventType.SYSTEM_START,
          message: `${req.method} ${req.path} ${res.statusCode}`,
          requestId,
          ip: req.ip,
          userAgent: req.get("user-agent"),
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        });
      } catch (err) {
        // Don't let audit logging errors break the request
        logger.error({ err }, "Failed to write audit event");
      }
      
      return originalSend.call(this, body);
    };
    
    // Continue processing
    next();
  };
}

/**
 * Log an audit event to the database or logger
 * 
 * This function should be called from within route handlers and middleware
 * to record security-relevant events.
 */
export async function logAuditEvent(options: {
  level: AuditLevel;
  category: AuditCategory;
  type: AuditEventType;
  message: string;
  userId?: number;
  sessionId?: number;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
}): Promise<void> {
  try {
    // Log the audit event
    logger.info({
      event: "audit_log",
      level: options.level,
      category: options.category,
      type: options.type,
      message: options.message,
      userId: options.userId,
      sessionId: options.sessionId,
      ip: options.ip,
      userAgent: options.userAgent,
      requestId: options.requestId,
      metadata: options.metadata,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      resourceName: options.resourceName,
    });
  } catch (error) {
    // Log the error but don't throw - audit failures shouldn't break the app
    logger.error({ error, options }, "Failed to write audit event");
  }
}