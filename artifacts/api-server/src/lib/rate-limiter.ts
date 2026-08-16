/**
 * Phase 19: Rate limiting middleware
 * 
 * Simple rate limiting for API endpoints to prevent abuse.
 */

import type { RequestHandler } from "express";

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup expired rate limit entries
 */
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get a key for rate limiting from the request
 */
function getRateLimitKey(req: import("express").Request): string {
  // Use IP address for rate limiting
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
  return ip.replace(/[:,]/g, "_"); // Sanitize for use as key
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const { windowMs, maxRequests } = options;

  return (req, res, next) => {
    // Skip rate limiting for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const key = `${getRateLimitKey(req)}:${req.path}`;
    const now = Date.now();

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      cleanupRateLimits();
    }

    const entry = rateLimitStore.get(key);

    if (!entry) {
      // First request in window
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader("X-RateLimit-Remaining", String(maxRequests - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (entry.resetTime <= now) {
      // Window has expired, reset counter
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader("X-RateLimit-Remaining", String(maxRequests - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (entry.count >= maxRequests) {
      // Rate limit exceeded
      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1000)));
      res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    // Increment counter
    entry.count++;
    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1000)));
    next();
  };
}

/**
 * Create a global rate limiter for all requests
 */
export function createGlobalRateLimiter(options: RateLimitOptions): RequestHandler {
  const { windowMs, maxRequests } = options;

  return (req, res, next) => {
    const key = getRateLimitKey(req);
    const now = Date.now();

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      cleanupRateLimits();
    }

    const entry = rateLimitStore.get(key);

    if (!entry) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader("X-RateLimit-Remaining", String(maxRequests - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (entry.resetTime <= now) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader("X-RateLimit-Remaining", String(maxRequests - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (entry.count >= maxRequests) {
      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1000)));
      res.status(429).json({
        error: "Rate limit exceeded. Please slow down.",
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    entry.count++;
    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1000)));
    next();
  };
}