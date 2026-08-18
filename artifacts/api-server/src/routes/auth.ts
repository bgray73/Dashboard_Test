import { Router, type IRouter, type RequestHandler } from "express";
import { cookiePolicy } from "../lib/auth-token";
import {
  IdentityNotProvisionedError,
  type BootstrapIdentity,
  type ValidatedIdentity,
} from "../lib/auth-store";
import {
  InvalidCallbackError,
  ProviderUnavailableError,
} from "../lib/auth-oidc";
import type { AuthRuntimeConfig } from "../lib/runtime-config";
import { logger } from "../lib/logger";

export type SessionResult = {
  sessionId: number;
  user: { id: string; displayName: string | null; email: string | null };
};
export type AuthRouteDependencies = {
  oidc: {
    beginLogin(): Promise<URL>;
    completeCallback(url: URL, state: string): Promise<ValidatedIdentity>;
  };
  store: {
    lookupSession(token: string): Promise<SessionResult | undefined>;
    mapIdentity(
      identity: ValidatedIdentity,
      bootstrap: BootstrapIdentity,
    ): Promise<{ id: string }>;
    issueSession(
      userId: string,
      priorToken?: string,
    ): Promise<{ token: string; absoluteExpiresAt: Date }>;
    revokeSession(token: string): Promise<void>;
  };
};

function noStore(res: Parameters<RequestHandler>[1]) {
  res.set("Cache-Control", "no-store");
}

function sendUnavailable(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
) {
  res.set("Retry-After", "30");
  if (req.get("accept")?.toLowerCase().includes("text/html")) {
    res
      .status(503)
      .type("html")
      .send(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LabOps sign-in unavailable</title><main><h1>Authentication is temporarily unavailable</h1><p>Try again in a moment.</p><p><a href="/api/auth/login">Try sign in again</a> · <a href="/">Return to LabOps</a></p></main>',
      );
    return;
  }
  res.status(503).json({ error: "Authentication provider unavailable." });
}

function callbackUrlFromRequest(
  originalUrl: string,
  publicBaseUrl: string,
): URL | undefined {
  const marker = "/api/auth/callback";
  if (originalUrl !== marker && !originalUrl.startsWith(`${marker}?`))
    return undefined;
  const url = new URL(marker, publicBaseUrl);
  const query = originalUrl.slice(marker.length);
  if (query) url.search = query.slice(1);
  return url;
}

export function createAuthRouter(
  config: AuthRuntimeConfig,
  deps: AuthRouteDependencies,
): IRouter {
  const router: IRouter = Router();
  const cookie = cookiePolicy(
    config.secureCookies,
    config.sessionAbsoluteTtlSeconds,
  );
  const readToken = (cookies: unknown): string | undefined => {
    if (!cookies || typeof cookies !== "object") return undefined;
    const value = (cookies as Record<string, unknown>)[cookie.name];
    return typeof value === "string" ? value : undefined;
  };
  const clear = (res: Parameters<RequestHandler>[1]) =>
    res.cookie(cookie.name, "", cookie.clear);

  router.get("/login", async (req, res) => {
    noStore(res);
    try {
      res.redirect(302, (await deps.oidc.beginLogin()).toString());
    } catch {
      logger.warn(
        {
          event: "auth_login",
          outcome: "provider_unavailable",
          requestId: req.id,
        },
        "Authentication login unavailable",
      );
      sendUnavailable(req, res);
    }
  });

  router.get("/callback", async (req, res) => {
    noStore(res);
    const url = callbackUrlFromRequest(req.originalUrl, config.publicBaseUrl);
    if (!url) {
      res.status(400).json({ error: "Invalid authentication callback." });
      return;
    }
    const states = url.searchParams.getAll("state");
    const codes = url.searchParams.getAll("code");
    const errors = url.searchParams.getAll("error");
    if (
      states.length !== 1 ||
      codes.length + errors.length !== 1 ||
      codes.length > 1 ||
      errors.length > 1
    ) {
      res.status(400).json({ error: "Invalid authentication callback." });
      return;
    }
    try {
      const identity = await deps.oidc.completeCallback(url, states[0]);
      const user = await deps.store.mapIdentity(identity, {
        issuer: config.bootstrapIssuer,
        subject: config.bootstrapSubject,
      });
      const prior = readToken(req.cookies);
      const issued = await deps.store.issueSession(user.id, prior);
      res.cookie(cookie.name, issued.token, cookie.set);
      res.redirect(303, `${config.publicBaseUrl}/`);
    } catch (error) {
      if (error instanceof IdentityNotProvisionedError) {
        logger.warn(
          {
            event: "auth_callback",
            outcome: "identity_not_provisioned",
            requestId: req.id,
          },
          "Authentication callback denied",
        );
        res.status(403).json({ error: "Identity is not provisioned." });
        return;
      }
      if (error instanceof InvalidCallbackError) {
        logger.warn(
          {
            event: "auth_callback",
            outcome: "invalid_callback",
            requestId: req.id,
          },
          "Authentication callback rejected",
        );
        res.status(400).json({ error: "Invalid authentication callback." });
        return;
      }
      if (error instanceof ProviderUnavailableError) {
        logger.warn(
          {
            event: "auth_callback",
            outcome: "provider_unavailable",
            requestId: req.id,
          },
          "Authentication callback unavailable",
        );
        sendUnavailable(req, res);
        return;
      }
      logger.error(
        {
          event: "auth_callback",
          outcome: "internal_error",
          requestId: req.id,
        },
        "Authentication callback failed",
      );
      res.status(500).json({ error: "Authentication failed." });
    }
  });

  router.get("/me", async (_req, res) => {
    noStore(res);
    const token = readToken(_req.cookies);
    const session = token ? await deps.store.lookupSession(token) : undefined;
    if (!session) {
      clear(res);
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    res.json(session.user);
  });

  router.post("/logout", async (req, res) => {
    noStore(res);
    const token = readToken(req.cookies);
    if (token) await deps.store.revokeSession(token);
    clear(res);
    res.sendStatus(204);
  });
  return router;
}

export function createMainAuthGuard(
  config: AuthRuntimeConfig,
  deps: AuthRouteDependencies,
): RequestHandler {
  const cookie = cookiePolicy(
    config.secureCookies,
    config.sessionAbsoluteTtlSeconds,
  );
  return async (req, res, next) => {
    noStore(res);
    const raw =
      req.cookies && typeof req.cookies === "object"
        ? (req.cookies as Record<string, unknown>)[cookie.name]
        : undefined;
    const session =
      typeof raw === "string" ? await deps.store.lookupSession(raw) : undefined;
    if (!session) {
      if (typeof raw === "string") res.cookie(cookie.name, "", cookie.clear);
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    res.locals.auth = session;
    next();
  };
}
