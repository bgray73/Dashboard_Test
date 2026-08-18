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
import { logger } from "./lib/logger";
import { AuthStore } from "./lib/auth-store";
import { OidcService, OpenidClientV6Protocol } from "./lib/auth-oidc";
import { createAuthorizationMiddleware } from "./lib/authorization";
import { createReadinessRouter } from "./routes/readiness";
import { renderMetrics } from "./lib/metrics";
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
  app.use(
    "/api/collector/v1",
    express.json({ limit: "16kb" }),
    collectorRouter,
  );
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(
    express.urlencoded({ extended: true, limit: config.urlencodedBodyLimit }),
  );
  app.use(cookieParser());

  app.use("/api", healthRouter);
  app.use("/api", createReadinessRouter(config, appLogger));
  app.use("/api/metrics", (_req, res) => {
    res.type("text/plain; version=0.0.4; charset=utf-8");
    res.send(renderMetrics());
  });
  app.use("/api/auth", createAuthRouter(config.auth, auth));
  app.use("/api", createMainAuthGuard(config.auth, auth));
  
  // Phase 19: Role-based authorization middleware
  app.use(createAuthorizationMiddleware(appLogger));
  
  app.use("/api", labopsRouter);

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
