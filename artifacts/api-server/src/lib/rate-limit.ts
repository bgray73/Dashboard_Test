/**
 * Phase 18: Rate Limiting Middleware
 *
 * Provides protection against brute force and abuse by limiting request rates
 * based on IP address and/or API key.
 */

import type { RequestHandler } from "express";
import { logger } from "./logger";

interface RateLimitConfig {
  windowMs: number;        // Size of the window in milliseconds
  maxRequests: number;     // Maximum number of requests per window
  message: string;         // Message to return when limit is exceeded
  statusCode: number;      // HTTP status code to return
  keyGenerator?: (req: any) => string; // Function to generate key for limiting
  skipFailedRequests?: boolean; // Skip counting failed requests (status >= 400)
  skipSuccessfulRequests?: boolean; // Skip counting successful requests (status < 400)
}

/**
 * In-memory store for rate limiting data
 * In production, this should be replaced with Redis or similar distributed store
 */
class MemoryStore {
  private readonly hits: Map<string, { count: number; resetTime: number }> = new Map();
  
  increment(key: string, windowMs: number): number {
    const now = Date.now();
    const record = this.hits.get(key);
    
    if (!record || record.resetTime < now) {
      // Reset the window
      this.hits.set(key, { count: 1, resetTime: now + windowMs });
      return 1;
    }
    
    // Increment existing window
    record.count++;
    this.hits.set(key, record);
    return record.count;
  }
  
  decrement(key: string): void {
    const record = this.hits.get(key);
    if (record && record.count > 0) {
      record.count--;
      if (record.count === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, record);
      }
    }
  }
  
  resetAll(): void {
    this.hits.clear();
  }
}

const store = new MemoryStore();

/**
 * Create rate limiting middleware
 */
export function createRateLimiter(
  config: Partial<RateLimitConfig> = {}
): RequestHandler {
  const {
    windowMs = 60000,           // 1 minute
    maxRequests = 100,          // 100 requests per window
    message = "Too many requests, please try again later.",
    statusCode = 429,           // Too Many Requests
    keyGenerator = (req: any) => req.ip || 'unknown',
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
  } = config;
  
  return async (req, res, next) => {
    // Generate key for this request
    const key = keyGenerator(req);
    
    // Check if we should skip counting based on response status
    // We'll check this after the request is processed
    let shouldCount = true;
    
    // Wrap res.send to check status before counting
    const originalSend = res.send;
    res.send = function(body: any) {
      // Determine if we should count this request based on status
      if (skipFailedRequests && res.statusCode >= 400) {
        shouldCount = false;
      }
      if (skipSuccessfulRequests && res.statusCode < 400) {
        shouldCount = false;
      }
      
      // If we should count, increment the counter
      if (shouldCount) {
        const current = store.increment(key, windowMs);
        
        // Check if limit exceeded
        if (current > maxRequests) {
          logger.warn({
            event: "rate_limit_exceeded",
            key,
            current,
            limit: maxRequests,
            windowMs,
            method: req.method,
            path: req.path,
            ip: req.ip,
          });
          
          return res.status(statusCode).send({
            error: message
          });
        }
      }
      
      // Call original send
      return originalSend.call(this, body);
    };
    
    // Continue to next middleware
    res.on('finish', () => {
      // Restore original send method
      res.send = originalSend;
    });
    
    next();
  };
}

/**
 * Create a rate limiter for authentication endpoints
 * Stricter limits to prevent brute force attacks
 */
export function createAuthRateLimiter(): RequestHandler {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,           // 5 attempts per 15 minutes
    message: "Too many authentication attempts, please try again later.",
    statusCode: 429,
    keyGenerator: (req: any) => {
      // Limit by IP for auth endpoints
      return req.ip || 'unknown';
    },
    skipFailedRequests: true, // Count failed attempts (4xx/5xx)
    skipSuccessfulRequests: false, // Don't count successful attempts
  });
}

/**
 * Create a rate limiter for API endpoints
 * General purpose rate limiting
 */
export function createApiRateLimiter(): RequestHandler {
  return createRateLimiter({
    windowMs: 60000,          // 1 minute
    maxRequests: 100,         // 100 requests per minute
    message: "Too many requests, please try again later.",
    statusCode: 429,
    keyGenerator: (req: any) => {
      // Limit by IP for API endpoints
      return req.ip || 'unknown';
    },
  });
}

/**
 * Create a rate limiter for collector endpoints
 * Collectors may have legitimate high-frequency heartbeats
 */
export function createCollectorRateLimiter(): RequestHandler {
  return createRateLimiter({
    windowMs: 60000,          // 1 minute
    maxRequests: 120,         // 2 per second (allows for burst)
    message: "Too many requests, please try again later.",
    statusCode: 429,
    keyGenerator: (req: any) => {
      // Limit by collector ID for collector endpoints
      const collectorId = req.header('x-labops-collector-id');
      return collectorId || req.ip || 'unknown';
    },
  });
}