import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { Writable } from "node:stream";
import { describe, it } from "node:test";
import type { Logger } from "pino";
import { createApp, type AuthDependencies } from "./app";
import { IdentityNotProvisionedError } from "./lib/auth-store";
import { createLogger } from "./lib/logger";
import type { RuntimeConfig } from "./lib/runtime-config";

const config: RuntimeConfig = {
  port: 5000,
  host: "127.0.0.1",
  databaseUrl: "postgresql://127.0.0.1/test",
  corsAllowedOrigins: [],
  trustProxy: false,
  jsonBodyLimit: "100kb",
  urlencodedBodyLimit: "100kb",
  reachabilityProvider: "local-icmp",
  auth: {
    issuerUrl: "https://id.example",
    clientId: "labops",
    clientSecret: "secret",
    clientAuthMethod: "client_secret_basic",
    publicBaseUrl: "https://lab.example",
    bootstrapIssuer: "https://id.example",
    bootstrapSubject: "approved",
    sessionIdleTtlSeconds: 1800,
    sessionAbsoluteTtlSeconds: 43200,
    flowTtlSeconds: 600,
    httpTimeoutMs: 5000,
    secureCookies: false,
  },
};

function fakes(): AuthDependencies & {
  lookups: string[];
  issuedPrior: Array<string | undefined>;
  revoked: string[];
} {
  const lookups: string[] = [],
    issuedPrior: Array<string | undefined> = [],
    revoked: string[] = [];
  return {
    lookups,
    issuedPrior,
    revoked,
    oidc: {
      beginLogin: async () =>
        new URL("https://id.example/authorize?state=safe"),
      completeCallback: async () => ({
        issuer: "https://id.example",
        subject: "approved",
        displayName: "Approved",
      }),
    },
    store: {
      lookupSession: async (token: string) => {
        lookups.push(token);
        return token === "valid-token"
          ? {
              sessionId: 1,
              user: { id: 7, displayName: "Approved", email: null },
            }
          : undefined;
      },
      mapIdentity: async () => ({ id: 7 }),
      issueSession: async (_userId: number, prior?: string) => {
        issuedPrior.push(prior);
        return {
          token: "new-session-token-0000000000000000000000000",
          absoluteExpiresAt: new Date(),
        };
      },
      revokeSession: async (token: string) => {
        revoked.push(token);
      },
    },
  };
}

async function request(
  path: string,
  init: RequestInit,
  deps = fakes(),
  production = false,
  appLogger?: Logger,
) {
  const app = createApp(config, deps, appLogger);
  if (production) app.set("env", "production");
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    return {
      response: await fetch(`http://127.0.0.1:${address.port}${path}`, {
        redirect: "manual",
        ...init,
      }),
      deps,
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function rawRequestTarget(target: string, deps = fakes()) {
  const server = createServer(createApp(config, deps));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const response = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        const req = httpRequest(
          {
            host: "127.0.0.1",
            port: address.port,
            method: "GET",
            path: target,
          },
          (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              body += chunk;
            });
            res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
          },
        );
        req.on("error", reject);
        req.end();
      },
    );
    return { response, deps };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const protectedRoutes: Array<[string, string]> = [
  ["GET", "/api/dashboard/summary"],
  ["GET", "/api/dashboard/recent-status"],
  ["GET", "/api/reports/summary"],
  ["GET", "/api/reports/devices.csv"],
  ["GET", "/api/reports/incidents.csv"],
  ["GET", "/api/reports/monitoring-history.csv"],
  ["GET", "/api/reports/availability"],
  ["GET", "/api/reports/availability.csv"],
  ["POST", "/api/dashboard/check-monitored"],
  ["GET", "/api/monitoring"],
  ["GET", "/api/maintenance-history"],
  ["GET", "/api/incidents"],
  ["GET", "/api/incidents/1/activity"],
  ["PATCH", "/api/incidents/1/acknowledgment"],
  ["GET", "/api/devices/1/monitoring-history"],
  ["GET", "/api/devices"],
  ["POST", "/api/devices"],
  ["GET", "/api/devices/1"],
  ["PATCH", "/api/devices/1"],
  ["DELETE", "/api/devices/1"],
  ["POST", "/api/devices/1/ping"],
  ["GET", "/api/saved-configurations"],
  ["POST", "/api/saved-configurations"],
  ["DELETE", "/api/saved-configurations/1"],
  ["GET", "/api/settings"],
  ["GET", "/api/settings/retention-status"],
  ["POST", "/api/settings/retention-cleanup"],
  ["PATCH", "/api/settings"],
  ["GET", "/api/notifications/deliveries"],
  ["POST", "/api/notifications/test"],
  ["POST", "/api/notifications/deliveries/1/retry"],
  ["POST", "/api/tools/ping"],
  ["GET", "/api/tools/reachability-capabilities"],
];

describe("authentication routes and default guard", () => {
  it("contains authentication-store failures without leaking thrown details", async () => {
    const leakedDetails = [
      "me-db-sensitive-detail",
      "logout-db-sensitive-detail",
      "guard-db-sensitive-detail",
    ];
    let stderr = "";
    let logOutput = "";
    const appLogger = createLogger(
      new Writable({
        write(chunk, _encoding, callback) {
          logOutput += chunk.toString();
          callback();
        },
      }),
    );
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr += chunk.toString();
      return true;
    }) as typeof process.stderr.write;

    try {
      const meDeps = fakes();
      meDeps.store.lookupSession = async () => {
        throw new Error(leakedDetails[0]);
      };
      const me = await request(
        "/api/auth/me",
        { method: "GET", headers: { cookie: "labops_session=valid-token" } },
        meDeps,
        true,
        appLogger,
      );

      const logoutDeps = fakes();
      logoutDeps.store.revokeSession = async () => {
        throw new Error(leakedDetails[1]);
      };
      const logout = await request(
        "/api/auth/logout",
        {
          method: "POST",
          headers: { cookie: "labops_session=valid-token" },
        },
        logoutDeps,
        true,
        appLogger,
      );

      const guardDeps = fakes();
      guardDeps.store.lookupSession = async () => {
        throw new Error(leakedDetails[2]);
      };
      const guard = await request(
        "/api/dashboard/summary",
        { method: "GET", headers: { cookie: "labops_session=valid-token" } },
        guardDeps,
        true,
        appLogger,
      );

      for (const response of [me.response, logout.response, guard.response]) {
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
          error: "Internal server error.",
        });
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
      assert.equal(logout.response.headers.get("set-cookie"), null);
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      process.stderr.write = originalWrite;
    }

    for (const detail of leakedDetails) {
      assert(!stderr.includes(detail));
      assert(!logOutput.includes(detail));
    }
    assert.match(logOutput, /"event":"request_failure"/);
    assert.match(logOutput, /"outcome":"internal_error"/);
  });

  it("guards every inventoried main route before handler/database logic", async () => {
    for (const [method, path] of protectedRoutes) {
      const { response, deps } = await request(path, {
        method,
        headers: { authorization: "Bearer collector-token" },
      });
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.deepEqual(await response.json(), {
        error: "Authentication required.",
      });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(deps.lookups, []);
    }
  });

  it("keeps health public and collector auth isolated from browser cookies", async () => {
    assert.equal(
      (await request("/api/healthz", { method: "GET" })).response.status,
      200,
    );
    const collector = await request("/api/collector/v1/heartbeat", {
      method: "POST",
      headers: {
        cookie: "labops_session=valid-token",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(collector.response.status, 401);
    assert.deepEqual(collector.deps.lookups, []);
  });

  it("redirects login with no-store and reports provider outage generically", async () => {
    const ok = await request("/api/auth/login", { method: "GET" });
    assert.equal(ok.response.status, 302);
    assert.equal(
      ok.response.headers.get("location"),
      "https://id.example/authorize?state=safe",
    );
    assert.equal(ok.response.headers.get("cache-control"), "no-store");
    const deps = fakes();
    deps.oidc.beginLogin = async () => {
      throw new Error("provider URL secret");
    };
    const failed = await request("/api/auth/login", { method: "GET" }, deps);
    assert.equal(failed.response.status, 503);
    assert.deepEqual(await failed.response.json(), {
      error: "Authentication provider unavailable.",
    });
    assert.equal(failed.response.headers.get("retry-after"), "30");
  });

  it("validates callback shape, rotates a pre-existing session, and disposes details", async () => {
    const deps = fakes();
    const result = await request(
      "/api/auth/callback?code=opaque&state=stored",
      { method: "GET", headers: { cookie: "labops_session=old-session" } },
      deps,
    );
    assert.equal(result.response.status, 303);
    assert.equal(
      result.response.headers.get("location"),
      "https://lab.example/",
    );
    assert.deepEqual(deps.issuedPrior, ["old-session"]);
    assert.match(
      result.response.headers.get("set-cookie") ?? "",
      /^labops_session=.*HttpOnly.*SameSite=Lax/,
    );
    const duplicate = await request(
      "/api/auth/callback?code=a&state=x&state=y",
      { method: "GET" },
    );
    assert.equal(duplicate.response.status, 400);
    assert.deepEqual(await duplicate.response.json(), {
      error: "Invalid authentication callback.",
    });
  });

  it("rejects duplicate callback code and error parameter combinations before session issuance", async () => {
    for (const query of [
      "code=first&code=second&state=stored",
      "error=access_denied&error=server_error&state=stored",
      "code=opaque&error=access_denied&state=stored",
    ]) {
      const deps = fakes();
      let callbacks = 0;
      deps.oidc.completeCallback = async () => {
        callbacks += 1;
        throw new Error("must not run");
      };

      const result = await request(
        `/api/auth/callback?${query}`,
        { method: "GET" },
        deps,
      );

      assert.equal(result.response.status, 400, query);
      assert.deepEqual(await result.response.json(), {
        error: "Invalid authentication callback.",
      });
      assert.equal(callbacks, 0, query);
      assert.deepEqual(deps.issuedPrior, [], query);
    }
  });

  it("rejects an absolute-form callback target before consuming the OIDC flow", async () => {
    const deps = fakes();
    let callbacks = 0;
    deps.oidc.completeCallback = async () => {
      callbacks += 1;
      throw new Error("must not run");
    };
    const result = await rawRequestTarget(
      "https://evil.example/api/auth/callback?code=opaque&state=stored",
      deps,
    );
    assert.equal(result.response.status, 400);
    assert.deepEqual(JSON.parse(result.response.body), {
      error: "Invalid authentication callback.",
    });
    assert.equal(callbacks, 0);
  });

  it("renders a generic browser-safe provider outage with retry actions", async () => {
    const deps = fakes();
    deps.oidc.beginLogin = async () => {
      throw new Error("upstream secret details");
    };
    const failed = await request(
      "/api/auth/login",
      { method: "GET", headers: { accept: "text/html" } },
      deps,
    );
    assert.equal(failed.response.status, 503);
    assert.match(
      failed.response.headers.get("content-type") ?? "",
      /text\/html/,
    );
    const html = await failed.response.text();
    assert.match(html, /Authentication is temporarily unavailable/);
    assert.match(html, /href="\/api\/auth\/login"/);
    assert.doesNotMatch(html, /upstream|OIDC|callback|provider|secret/i);
  });

  it("returns local me during provider outage and clears invalid sessions", async () => {
    const deps = fakes();
    deps.oidc.beginLogin = async () => {
      throw new Error("offline");
    };
    const me = await request(
      "/api/auth/me",
      { method: "GET", headers: { cookie: "labops_session=valid-token" } },
      deps,
    );
    assert.equal(me.response.status, 200);
    assert.deepEqual(await me.response.json(), {
      id: 7,
      displayName: "Approved",
      email: null,
    });
    const missing = await request(
      "/api/auth/me",
      { method: "GET", headers: { cookie: "labops_session=expired" } },
      deps,
    );
    assert.equal(missing.response.status, 401);
    assert.match(missing.response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });

  it("logs out idempotently and remains local during provider outage", async () => {
    const deps = fakes();
    deps.oidc.beginLogin = async () => {
      throw new Error("offline");
    };
    const result = await request(
      "/api/auth/logout",
      { method: "POST", headers: { cookie: "labops_session=valid-token" } },
      deps,
    );
    assert.equal(result.response.status, 204);
    assert.deepEqual(deps.revoked, ["valid-token"]);
    assert.match(result.response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  });

  it("returns generic 403 for an unprovisioned callback identity", async () => {
    const deps = fakes();
    deps.store.mapIdentity = async () => {
      throw new IdentityNotProvisionedError();
    };
    const result = await request(
      "/api/auth/callback?code=opaque&state=stored",
      { method: "GET" },
      deps,
    );
    assert.equal(result.response.status, 403);
    assert.deepEqual(await result.response.json(), {
      error: "Identity is not provisioned.",
    });
  });

  it("does not misclassify a local session-store failure as a provider outage", async () => {
    const deps = fakes();
    deps.store.issueSession = async () => {
      throw new Error("database connection detail");
    };
    const result = await request(
      "/api/auth/callback?code=opaque&state=stored",
      { method: "GET" },
      deps,
    );
    assert.equal(result.response.status, 500);
    assert.deepEqual(await result.response.json(), {
      error: "Authentication failed.",
    });
    assert.equal(result.response.headers.get("retry-after"), null);
  });
});
