import express, { type ErrorRequestHandler, type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { Logger } from "pino";
import { pool } from "@workspace/db";
import collectorRouter from "./routes/collector";
import healthRouter from "./routes/health";
import labopsRouter from "./routes/labops";
import {
  createAuthRouter,
  createMainAuthGuard,
  type AuthRouteDependencies,
} from "./routes/auth";
import { createAuthorizationMiddleware } from "./lib/authorization";
import { createCsrfProtection, setCsrfToken } from "./lib/csrf";
import { createAuthRateLimiter, createApiRateLimiter, createCollectorRateLimiter } from "./lib/rate-limit";
import { createAuditLogging } from "./lib/audit-events";
import { logger } from "./lib/logger";
import { AuthStore } from "./lib/auth-store";
import { OidcService, OpenidClientV6Protocol } from "./lib/auth-oidc";
import type { RuntimeConfig } from "./lib/runtime-config";

export type AuthDependencies = AuthRouteDependencies;

export function createDefaultAuthDependencies(
  config: RuntimeConfig,
): AuthDependencies & { store: AuthStore } {
  const store = new AuthStore(pool, {
    idleTtlSeconds: config.auth.sessionIdleTtlSeconds,
    absoluteTtlSeconds: config.auth.sessionAbsoluteTtlSeconds,
  });
  const protocol = new OpenidClientV6Protocol(config.auth);
  const oidc = new OidcService(pool, protocol, {
    issuer: config.auth.issuerUrl,
    clientAuthMethod: config.auth.clientAuthMethod,
    flowTtlSeconds: config.auth.flowTtlSeconds,
  });
  return { store, oidc };
}

export function createApp(
  config: RuntimeConfig,
  injectedAuth?: AuthDependencies,
  appLogger: Logger = logger,
): Express {
  const auth = injectedAuth ?? createDefaultAuthDependencies(config);
  const app: Express = express();
  app.set("trust proxy", config.trustProxy);
  app.use(
    pinoHttp({
      logger: appLogger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );
  app.use(helmet());
  
  // CORS middleware - applied first so all routes benefit
  app.use(
    cors({
      origin(origin, callback) {
        callback(
          null,
          origin !== undefined && config.corsAllowedOrigins.includes(origin),
        );
      },
    }),
  );
  
  // Collector API has its own body limit and auth - must come before general body parser
  app.use(
    "/api/collector/v1",
    express.json({ limit: "16kb" }),
    createCollectorRateLimiter(),
    collectorRouter,
  );
  
  // Body parsing for general API routes
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(
    express.urlencoded({ extended: true, limit: config.urlencodedBodyLimit }),
  );
  app.use(cookieParser());
  
  // Health routes (public)
  app.use("/api", healthRouter);
  
  // Auth routes (public)
  app.use("/api/auth", createAuthRouter(config.auth, auth));
  
  // Security middleware - Phase 18
  // These should only apply to browser-session protected routes (/api/* excluding above)
  const csrfSecret = config.csrfSecret || "default-csrf-secret-change-in-production";
  app.use("/api/", createCsrfProtection(csrfSecret));
  app.use("/api/", setCsrfToken(csrfSecret));
  
  // Rate limiting - Phase 18
  app.use("/api/auth/", createAuthRateLimiter()); // Stricter limits for auth
  app.use("/api/", createApiRateLimiter()); // General API limits
  
  // Audit logging - Phase 18
  app.use(createAuditLogging());
  
  // Main auth guard for browser sessions (applies to remaining /api routes)
  app.use("/api/", createMainAuthGuard(config.auth, auth));
  
  // Labops routes (browser session protected)
  app.use("/api/", labopsRouter);

  const payloadTooLargeHandler: ErrorRequestHandler = (
    error,
    _req,
    res,
    next,
  ) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 413
    ) {
      res.status(413).json({ error: "Payload too large." });
      return;
    }
    next(error);
  };
  app.use(payloadTooLargeHandler);

  const finalErrorHandler: ErrorRequestHandler = (_error, req, res, _next) => {
    req.log.error(
      {
        event: "request_failure",
        outcome: "internal_error",
        requestId: req.id,
      },
      "Unhandled application error",
    );
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(500).json({ error: "Internal server error." });
  };
  app.use(finalErrorHandler);
  return app;
}