/**
 * Phase 19: CSRF protection middleware
 * 
 * CSRF-token middleware to protect state-changing operations
 * from cross-site request forgery attacks.
 */

import crypto from "node:crypto";
import type { RequestHandler } from "express";

export interface CsrfToken {
  token: string;
  createdAt: Date;
}

// In-memory store for CSRF tokens (would need persistent store in production)
const csrfTokens = new Map<string, { token: string; expires: Date }>();

// Token lifespan: 1 hour
const CSRF_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create CSRF middleware
 */
export function createCsrfMiddleware(): RequestHandler {
  return async (req, res, next) => {
    // Skip CSRF for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }
    
    // Get CSRF token from header or body
    const csrfHeader = req.headers["x-csrf-token"] as string | undefined;
    const csrfBody = (req as any).body?.csrfToken as string | undefined;
    const csrfToken = csrfHeader || csrfBody;
    
    if (!csrfToken) {
      res.status(403).json({ error: "CSRF token required." });
      return;
    }
    
    // Verify token (in production, this would check against stored hash)
    const stored = csrfTokens.get(csrfToken);
    if (!stored || stored.expires < new Date()) {
      csrfTokens.delete(csrfToken);
      res.status(403).json({ error: "Invalid or expired CSRF token." });
      return;
    }
    
    next();
  };
}

/**
 * Register CSRF token for a session
 */
export function registerCsrfToken(sessionId: string): string {
  const token = generateCsrfToken();
  const expires = new Date(Date.now() + CSRF_TOKEN_TTL_MS);
  csrfTokens.set(token, { token, expires });
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(token: string): boolean {
  const stored = csrfTokens.get(token);
  if (!stored || stored.expires < new Date()) {
    if (stored) csrfTokens.delete(token);
    return false;
  }
  return true;
}

/**
 * Cleanup expired tokens
 */
export function cleanupCsrfTokens(): void {
  const now = new Date();
  for (const [token, entry] of csrfTokens.entries()) {
    if (entry.expires < now) {
      csrfTokens.delete(token);
    }
  }
}