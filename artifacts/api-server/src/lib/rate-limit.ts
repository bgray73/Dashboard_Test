/**
 * Phase 19: Rate limiting middleware
 * 
 * Rate limits for API protection
 */

import type { RequestHandler } from "express";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limits
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig): RequestHandler {
  // Start cleanup interval if not already running
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt <= now) {
          rateLimitStore.delete(key);
        }
      }
    }, config.windowMs).unref();
  }
  
  return async (req, res, next) => {
    const key = generateRateLimitKey(req);
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt <= now) {
      // Reset window
      entry = { count: 1, resetAt: now + config.windowMs };
    } else if (entry.count >= config.maxRequests) {
      // Rate limit exceeded
      res.status(429).json({
        error: config.message || "Too many requests.",
      });
      return;
    } else {
      // Increment counter
      entry.count++;
    }
    
    rateLimitStore.set(key, entry);
    
    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, config.maxRequests - entry.count)));
    res.setHeader("X-RateLimit-Reset", String(entry.resetAt));
    
    next();
  };
}

/**
 * Generate rate limit key from request
 */
function generateRateLimitKey(req: import("express").Request): string {
  // Use user ID if authenticated, otherwise IP
  const userId = (req as any).session?.user?.id;
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP + User-Agent for anonymous requests
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const ua = req.headers["user-agent"] || "unknown";
  return `${ip}:${ua}`;
}

/**
 * Create endpoint-specific rate limiter
 */
export function createEndpointRateLimiter(
  endpoint: string,
  config: RateLimitConfig,
): RequestHandler {
  return async (req, res, next) => {
    const key = `${endpoint}:${generateRateLimitKey(req)}`;
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + config.windowMs };
    } else if (entry.count >= config.maxRequests) {
      res.status(429).json({
        error: config.message || `Rate limit exceeded for ${endpoint}.`,
      });
      return;
    } else {
      entry.count++;
    }
    
    rateLimitStore.set(key, entry);
    next();
  };
}